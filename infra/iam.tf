# ── EC2 Instance Role ─────────────────────────────────────────────────────────
# Allows EC2 to read Secrets Manager and write CloudWatch logs
# No static credentials needed — IAM role = secure by design

resource "aws_iam_role" "ec2" {
  name = "${var.app_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = { Name = "${var.app_name}-ec2-role" }
}

# Allow EC2 to read the app secret from Secrets Manager
resource "aws_iam_role_policy" "ec2_secrets" {
  name = "${var.app_name}-ec2-read-secrets"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = aws_secretsmanager_secret.app.arn
      },
      {
        # KMS decrypt for the secret (uses AWS managed key)
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# CloudWatch Agent — ship PM2 logs to CloudWatch Logs
resource "aws_iam_role_policy_attachment" "ec2_cloudwatch" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# SSM — allows AWS Systems Manager Session Manager (SSH alternative, no port 22)
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile — attaches the role to EC2 instances
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.app_name}-ec2-profile"
  role = aws_iam_role.ec2.name

  tags = { Name = "${var.app_name}-ec2-profile" }
}
