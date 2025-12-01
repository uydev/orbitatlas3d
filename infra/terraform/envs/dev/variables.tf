variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "instance_type" {
  type    = string
  default = "t3.small"  # 2 vCPU, 2 GB RAM (upgraded from t3.micro for better build performance)
}

variable "key_name" {
  type        = string
  description = "Existing EC2 key pair name for SSH access. Leave empty to disable SSH."
  default     = ""
}

variable "git_repo_url" {
  type        = string
  description = "Git repository URL for the OrbitAtlas3D app."
  default     = "https://github.com/uydev/orbitatlas3d.git"
}


