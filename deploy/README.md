# TeamTree — Deployment

This directory contains everything needed to deploy TeamTree to a Linux VM:

| File | Purpose |
|---|---|
| `deploy.sh` | Main deployment script (build + sync + configure) |
| `nginx.conf` | Nginx virtual host — HTTPS termination and gzip |
| `teamtree.conf` | Nginx routing rules (API proxy, asset caching, SPA fallback) |
| `teamtree-api.service` | systemd unit for the Node.js backend |
| `.env.production.example` | Template for the server `.env` file |
| `.env.development.example` | Template for local development `.env` |

---

## Prerequisites

- **Local**: `yarn`, `rsync`, `ssh` available in your `PATH`
- **Remote VM**: Debian/Ubuntu-based Linux, SSH access with `sudo` rights, Node.js installed

---

## First-time deploy

### 1. Configure SSH access

Make sure you can reach the VM without a password prompt:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519 user@your-vm-ip
```

### 2. Create the server `.env` on the VM

SSH into the VM, create the server directory, and populate the environment file from the example:

```bash
sudo mkdir -p /opt/teamtree-server
sudo chown $USER:$USER /opt/teamtree-server
cp deploy/.env.production.example /opt/teamtree-server/.env
# Edit /opt/teamtree-server/.env and fill in all values
```

See [`.env.production.example`](.env.production.example) for the full list of required variables (GitLab OAuth credentials, Redis URL, etc.).

### 3. Run the full first-time deploy

```bash
./deploy/deploy.sh \
  --host <vm-ip> \
  --with-nginx \
  --with-service \
  --all
```

This single command will:

1. Build the Vite frontend locally and sync `dist/` to `/www/teamtree`
2. Build the Node.js server locally, sync it to `/opt/teamtree-server`, and install production dependencies
3. Run database migrations
4. Install and configure Nginx with HTTPS (you still need to provide SSL certificates — see [SSL](#ssl))
5. Install and enable the `teamtree-api` systemd service

> The service is **enabled but not started** by this step, giving you a chance to verify the `.env` file before the first boot.

Start the service manually:

```bash
sudo systemctl start teamtree-api
journalctl -u teamtree-api -f
```

---

## Day-to-day updates

### Update frontend only

```bash
./deploy/deploy.sh --host <vm-ip> --update-frontend
```

### Update backend and run migrations

```bash
./deploy/deploy.sh --host <vm-ip> --update-server --update-db
```

### Update everything

```bash
./deploy/deploy.sh --host <vm-ip> --all
```

### Update nginx routing rules only

```bash
./deploy/deploy.sh --host <vm-ip> --update-proxy-conf
```

---

## SSL

`nginx.conf` expects certificate files at:

```
/etc/ssl/certs/teamtree.crt
/etc/ssl/private/teamtree.key
```

The easiest way to provision them is with [Certbot](https://certbot.eff.org/):

```bash
sudo certbot --nginx -d your-domain.example.com
```

Certbot will rewrite the `ssl_certificate` / `ssl_certificate_key` directives automatically. HSTS can then be uncommented in `nginx.conf` once HTTPS is confirmed working.

---

## Reference

### Full option list

```
Usage: ./deploy/deploy.sh [options] <action(s)>

Connection:
  --host <host>         VM hostname or IP (required, or set DEPLOY_HOST)
  --user <user>         SSH user (default: current user)
  --key  <path>         SSH private key (default: let SSH choose)
  --port <port>         SSH port (default: 22)

Paths:
  --dir  <path>         Remote frontend directory  (default: /www/teamtree)
  --server-dir <path>   Remote server directory    (default: /opt/teamtree-server)
  --api-port <port>     Node.js server port        (default: 3001)
  --service <name>      systemd service name       (default: teamtree-api)

Update actions (at least one required):
  --update-frontend     Build and sync Vite app
  --update-server       Build, sync, and restart the Node.js server
  --update-db           Run database migrations
  --all                 All three actions above

One-time setup (opt-in):
  --with-nginx          Install nginx and deploy virtual host config
  --update-proxy-conf   Re-upload routing rules and reload nginx
  --with-service        Install and enable the teamtree-api systemd unit
```

All `--host/--user/--key/--port` flags can also be set via environment variables (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KEY`, `DEPLOY_PORT`).

### Useful post-deploy commands

```bash
# Follow server logs
journalctl -u teamtree-api -f

# Check service status
systemctl status teamtree-api

# Test nginx config before reload
sudo nginx -t && sudo systemctl reload nginx
```
