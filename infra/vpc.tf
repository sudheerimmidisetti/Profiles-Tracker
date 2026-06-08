# ── VPC ──────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true   # required for RDS/ElastiCache DNS resolution
  enable_dns_support   = true

  tags = { Name = "${var.app_name}-vpc" }
}

# ── Availability Zones ───────────────────────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

# ── Public Subnets (ALB + EC2) ───────────────────────────────────────────────
resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true   # EC2 instances get public IPs for outbound scraping

  tags = {
    Name = "${var.app_name}-public-${count.index + 1}"
    Tier = "Public"
  }
}

# ── Private Subnets (RDS + Redis) ────────────────────────────────────────────
resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = false   # CRITICAL: private subnets have NO public IPs

  tags = {
    Name = "${var.app_name}-private-${count.index + 1}"
    Tier = "Private"
  }
}

# ── Internet Gateway (public subnet egress) ───────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.app_name}-igw" }
}

# ── Elastic IPs for NAT Gateways ──────────────────────────────────────────────
resource "aws_eip" "nat" {
  count  = length(var.public_subnet_cidrs)
  domain = "vpc"
  tags   = { Name = "${var.app_name}-nat-eip-${count.index + 1}" }
}

# ── NAT Gateways (one per AZ for HA — EC2 outbound for scraping) ─────────────
# NOTE: Each NAT Gateway costs ~$32/mo. Use count=1 to save $32 if HA not critical.
resource "aws_nat_gateway" "main" {
  count         = length(var.public_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = { Name = "${var.app_name}-nat-${count.index + 1}" }

  depends_on = [aws_internet_gateway.main]
}

# ── Public Route Table ────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.app_name}-rtb-public" }
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── Private Route Tables (one per AZ → different NAT GW) ─────────────────────
resource "aws_route_table" "private" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = { Name = "${var.app_name}-rtb-private-${count.index + 1}" }
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
