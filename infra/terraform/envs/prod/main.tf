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
      echo "✓ Deploying OrbitAtlas3D (prod) to correct account: $ACTUAL_ACCOUNT"
    EOT
  }

  triggers = {
    always_run = timestamp()
  }
}

