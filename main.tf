data "aws_caller_identity" "current" {}

# tfsec:ignore:aws-ecr-repository-customer-key
resource "aws_ecr_repository" "repository" {
  name                 = var.repository_name
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }
}

resource "aws_ecr_lifecycle_policy" "name" {
  repository = aws_ecr_repository.repository.name
  policy     = templatefile(var.lifecycle_policy, {})
}