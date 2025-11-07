# OrbitAtlas 3D

Production-grade monorepo that renders a Google-Earth-quality 3D/2D globe and tracks satellites in near real-time, with search, filters, orbits, ground tracks, visibility, overflight, and AWS Free Tier deploy.

Quick start:

```
make setup
make dev
make doctor
```

AWS deploy (dev env):

```
cd infra/terraform/envs/dev
terraform apply
```

Tokens & secrets: put web vars in `apps/web/.env`, API DB/Redis in Compose env, and use AWS Secrets Manager in prod.

License: MIT. See NOTICE for attributions.



