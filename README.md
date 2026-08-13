# Mariarty Ink — Cloud IT Project

!!! Default admin login: `admin@mariarty.com`/`tattoo2024`

A tattoo studio web application built as a cloud-native microservice system - a static frontend, an API Gateway, three backend microservices, and one serverless-style component, all containerized with Docker and orchestrated with Kubernetes.

Product images are stored in **Azure Blob Storage** and referenced by URL from `shop-service`; nothing image-related is stored on disk in the containers.

## Repository structure

```
Cloud IT Project/
├── frontend/              
│   ├── index.html, booking.html, shop.html, cart.html, account.html, conventions.html
│   ├── script.js          All REST calls, cart logic, auth, calendar UI
│   ├── style.css
│   └── Dockerfile
├── gateway/                API Gateway — auth, routing, single entry point on :5000
│   ├── gateway.py
│   ├── requirements.txt
│   └── Dockerfile
├── booking-service/        Microservice — appointments, port :5001
│   ├── app.py
│   ├── requirements.txt
│   └── Dockerfile
├── shop-service/           Microservice — product catalog & orders, port :5003
│   ├── app.py
│   ├── requirements.txt
│   └── Dockerfile
├── email-serverless/       Serverless-style component, port :5002
│   ├── function.py         Handler (lambda_handler-style), the actual serverless logic
│   ├── app.py              Thin Flask wrapper so it's callable over HTTP locally/in-cluster
│   ├── requirements.txt
│   └── Dockerfile
├── k8s/
│   └── deployments.yaml    Deployments + Services for all 5 components
├── docker-compose.yml      Local multi-container orchestration
└── requirements.txt        
```


## API reference (via the Gateway, port 5000)

Method | Path - Description 

GET | `/health` - Gateway health check 
POST | `/api/register` - Create a client account (grants 10% shop discount) 
POST | `/api/login` - Authenticate, returns role + session expiry 
GET/POST | `/api/bookings` - List/create bookings → proxied to `booking-service` 
PUT/DELETE | `/api/bookings/<id>` - Update status/delete a booking → proxied to `booking-service` 
GET | `/api/products` - Product catalog → proxied to `shop-service` 
POST | `/api/orders` - Submit a cart checkout → proxied to `shop-service`

Internally, `booking-service` also calls `email-serverless` on `POST /send-email` after every new booking, to dispatch a confirmation.


## Data persistence

`gateway`, `booking-service`, and `shop-service' each store their SQLite database under a `DATA_DIR` path (defaults to `./data`, overridable via env var):

- **Local (Docker Compose)**: each service's `data/` folder is a named Docker volume, so data survives `docker compose down` and rebuilds
- **Kubernetes**: each of the three services has its own `PersistentVolumeClaim` mounted at `/app/data`, so data survives pod restarts and redeploys

Because SQLite doesn't support safe concurrent writers, each of these three deployments is kept at `replicas: 1`. Scaling any of them to multiple replicas would require moving to a real networked database (e.g. Azure Database for PostgreSQL) instead of SQLite-on-a-volume — worth doing if the website outgrows the current scale.

## Known limitations

- **Cart is client-side.** Cart contents live in `localStorage` on the browser rather than a service — this is intentional; an unpurchased cart is disposable pre-checkout state, and this is standard practice even on large e-commerce sites.
