terraform {
  required_version = ">= 1.8.0"
}

provider "aws" {
  profile = "hephaestus-fleet"
  region  = var.region
}

data "aws_caller_identity" "current" {}

resource "null_resource" "verify_account" {
  provisioner "local-exec" {
    command = <<-EOT
      EXPECTED_ACCOUNT="901465080034"
      ACTUAL_ACCOUNT="${data.aws_caller_identity.current.account_id}"
      if [ "$EXPECTED_ACCOUNT" != "$ACTUAL_ACCOUNT" ]; then
        echo "ERROR: Wrong AWS account! Expected $EXPECTED_ACCOUNT but got $ACTUAL_ACCOUNT"
        exit 1
      fi
      echo "✓ Deploying OrbitAtlas3D (dev) to correct account: $ACTUAL_ACCOUNT"
    EOT
  }

  triggers = {
    always_run = timestamp()
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "orbit_vpc" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "orbitatlas3d-dev-vpc"
    Project     = "OrbitAtlas3D"
    Environment = "dev"
  }

  depends_on = [null_resource.verify_account]
}

resource "aws_internet_gateway" "orbit_igw" {
  vpc_id = aws_vpc.orbit_vpc.id

  tags = {
    Name        = "orbitatlas3d-dev-igw"
    Project     = "OrbitAtlas3D"
    Environment = "dev"
  }
}

resource "aws_subnet" "orbit_public_subnet" {
  vpc_id                  = aws_vpc.orbit_vpc.id
  cidr_block              = "10.20.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name        = "orbitatlas3d-dev-public-subnet"
    Project     = "OrbitAtlas3D"
    Environment = "dev"
  }
}

resource "aws_route_table" "orbit_public_rt" {
  vpc_id = aws_vpc.orbit_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.orbit_igw.id
  }

  tags = {
    Name        = "orbitatlas3d-dev-public-rt"
    Project     = "OrbitAtlas3D"
    Environment = "dev"
  }
}

resource "aws_route_table_association" "orbit_public_rta" {
  subnet_id      = aws_subnet.orbit_public_subnet.id
  route_table_id = aws_route_table.orbit_public_rt.id
}

resource "aws_security_group" "orbit_sg" {
  name        = "orbitatlas3d-dev-sg"
  description = "Security group for OrbitAtlas3D dev EC2 instance"
  vpc_id      = aws_vpc.orbit_vpc.id

  # HTTP (web)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  # Optional: direct API / dev ports
  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "API"
  }

  ingress {
    from_port   = 5173
    to_port     = 5173
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Vite dev / web"
  }

  # SSH (optional; requires key pair)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "orbitatlas3d-dev-sg"
    Project     = "OrbitAtlas3D"
    Environment = "dev"
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "orbit_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.orbit_public_subnet.id
  vpc_security_group_ids = [aws_security_group.orbit_sg.id]
  associate_public_ip_address = true

  key_name = var.key_name != "" ? var.key_name : null

  user_data = <<-EOF
#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y docker.io git docker-compose-plugin

systemctl enable docker
systemctl start docker

cd /opt
if [ ! -d "orbitatlas3d" ]; then
  git clone "${var.git_repo_url}" orbitatlas3d
fi

cd orbitatlas3d/orbitatlas-3d/infra/docker

docker compose pull || true
docker compose up -d --build
EOF

  tags = {
    Name        = "orbitatlas3d-dev-server"
    Project     = "OrbitAtlas3D"
    Environment = "dev"
  }

  depends_on = [aws_route_table_association.orbit_public_rta]
}


