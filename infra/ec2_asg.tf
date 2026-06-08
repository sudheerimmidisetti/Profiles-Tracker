# ── Latest Ubuntu 22.04 AMI ───────────────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]   # Canonical (official Ubuntu AMIs)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── User Data Script ──────────────────────────────────────────────────────────
# Runs on every new EC2 instance launched by the ASG.
# Fetches secrets from Secrets Manager and starts the Node.js server via PM2.
locals {
  user_data = base64encode(templatefile("${path.module}/user_data.sh.tpl", {
    app_name    = var.app_name
    aws_region  = var.aws_region
    secret_name = "${var.app_name}/production"
    github_repo = var.github_repo
  }))
}

# ── Launch Template ───────────────────────────────────────────────────────────
resource "aws_launch_template" "api" {
  name_prefix   = "${var.app_name}-lt-"   # name_prefix enables new version on each update
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.ec2_instance_type
  key_name      = var.ec2_key_name

  # IAM role for Secrets Manager + CloudWatch
  iam_instance_profile {
    arn = aws_iam_instance_profile.ec2.arn
  }

  # Network
  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ec2.id]
    delete_on_termination       = true
  }

  # Root volume
  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 20
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  # Instance startup script
  user_data = local.user_data

  # Metadata service — IMDSv2 only (more secure than v1)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"   # Forces IMDSv2
    http_put_response_hop_limit = 1
  }

  monitoring {
    enabled = true   # Detailed CloudWatch monitoring (1-min interval)
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "${var.app_name}-api"
      Environment = var.environment
    }
  }

  tag_specifications {
    resource_type = "volume"
    tags = {
      Name = "${var.app_name}-api-volume"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ── Auto Scaling Group ────────────────────────────────────────────────────────
resource "aws_autoscaling_group" "api" {
  name = "${var.app_name}-asg"

  # Use launch template (not launch config — deprecated)
  launch_template {
    id      = aws_launch_template.api.id
    version = "$Latest"
  }

  # Multi-AZ: spread across both public subnets
  vpc_zone_identifier = aws_subnet.public[*].id

  # Sizes
  min_size         = var.asg_min
  desired_capacity = var.asg_desired
  max_size         = var.asg_max

  # Register with the ALB Target Group
  target_group_arns = [aws_lb_target_group.api.arn]

  # Use ALB health checks (not just EC2 system health)
  health_check_type         = "ELB"
  health_check_grace_period = 120   # Give Node.js time to start + fetch secrets

  # Instance distribution across AZs
  # "Balanced Best Effort" keeps instances evenly distributed across AZs
  # without failing the scale-out if one AZ runs out of capacity
  default_instance_warmup = 60

  # Termination policy: terminate oldest launch template first (ensures rolling deploys
  # replace stale instances before newer ones)
  termination_policies = ["OldestLaunchTemplate", "OldestInstance"]

  # Tags propagated to all instances
  tag {
    key                 = "Name"
    value               = "${var.app_name}-api"
    propagate_at_launch = true
  }

  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }

  # Instance refresh configuration — rolling deploys with zero downtime
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50     # Keep at least 50% of instances healthy during deploy
      instance_warmup        = 120    # Wait 120s before health checking new instances
    }
    triggers = ["launch_template"]    # Refresh when launch template changes
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [desired_capacity]   # Don't reset desired count after scaling events
  }
}

# ── Auto Scaling Policies ─────────────────────────────────────────────────────

# Target tracking: maintain 60% average CPU
resource "aws_autoscaling_policy" "cpu_target" {
  name                   = "${var.app_name}-cpu-target-tracking"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value      = 60.0
    disable_scale_in  = false
  }
}

# Step scaling OUT — fast scale-out when CPU spikes
resource "aws_autoscaling_policy" "scale_out" {
  name                   = "${var.app_name}-scale-out"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "StepScaling"
  adjustment_type        = "ChangeInCapacity"

  step_adjustment {
    metric_interval_lower_bound = 0    # CPU > 80%
    metric_interval_upper_bound = 20   # CPU 80-100%
    scaling_adjustment          = 2    # Add 2 instances
  }
  step_adjustment {
    metric_interval_lower_bound = 20   # CPU > 100% (theoretical)
    scaling_adjustment          = 3    # Add 3 instances
  }
}

# CloudWatch Alarm: high CPU → trigger scale out
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.app_name}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Scale out when CPU > 80% for 2 minutes"
  alarm_actions       = [aws_autoscaling_policy.scale_out.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.api.name
  }
}

# Step scaling IN — slow scale-in to avoid thrashing
resource "aws_autoscaling_policy" "scale_in" {
  name                   = "${var.app_name}-scale-in"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "StepScaling"
  adjustment_type        = "ChangeInCapacity"

  step_adjustment {
    metric_interval_upper_bound = 0   # CPU < 30%
    scaling_adjustment          = -1  # Remove 1 instance
  }
}

# CloudWatch Alarm: low CPU → trigger scale in
resource "aws_cloudwatch_metric_alarm" "cpu_low" {
  alarm_name          = "${var.app_name}-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 10   # 10 mins at low CPU before scaling in
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 30
  alarm_description   = "Scale in when CPU < 30% for 10 minutes"
  alarm_actions       = [aws_autoscaling_policy.scale_in.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.api.name
  }
}
