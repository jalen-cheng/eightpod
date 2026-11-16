# Reaching the Pod away from home (Tailscale)

**Status: researched, not yet set up or tested on a Pod.** This page records the options and what was
found on the test Pod 5, so the setup can be done in one sitting. Sources are at the bottom.

Free Sleep's page has no login, so it must never be put on the open internet. [Tailscale](https://tailscale.com)
gives your own phone and computer a private path to it instead.

## Two ways to do it

| | A. Another device at home relays (subnet router) | B. Tailscale on the Pod itself |
|---|---|---|
| Changes on the Pod | None. It stays fully offline. | Tailscale installed, and the internet block opened for Tailscale's servers. |
| Needs | An always-on device at home: an Apple TV that is a Home hub, a Raspberry Pi, or a router with Tailscale built in (GL.iNet). A Mac works only while awake. | Nothing else. |
| Address you use | The Pod's home address, `http://<pod-ip>:3000` | A fixed name, `http://eight-pod.<your-tailnet>.ts.net:3000`, at home and away |
| Main weakness | Fails when you are on another network that uses the same address range as home. `10.0.0.x` (the Xfinity default) is common, so this will happen. | The Pod's firewall cannot allow "only Tailscale" (see below), so it needs a list of server addresses that can go stale. |
| Effort | About ten minutes in the Tailscale app and admin page. | About an hour over SSH, plus upkeep. |

**Recommendation:** if there is an Apple TV (or other always-on device) at home, start with A: it is
the least work and the Pod stays sealed. Move to B only if the address clash gets in the way.

## What was found on the test Pod 5

| Check | Result | Meaning |
|---|---|---|
| `uname -m` | `aarch64` | Tailscale's arm64 static build fits. |
| `/dev/net/tun` | present | Not needed for the recommended mode, but available. |
| Kernel WireGuard | not built in | Not needed; Tailscale brings its own. |
| `/persistent` | 13 GB free | Room for the program and its state, which survive firmware slot changes. |
| Memory | 3.9 GB, 3.3 GB free | Plenty. |
| `iptables -m owner` | **not available** | The firewall cannot allow traffic by program. Tailscale's servers have to be allowed by address. |
| Host check in Free Sleep | none | The page answers under any name, so a Tailscale name works without changes. |

## A. Relay through another device at home

With an Apple TV (tvOS 17 or later, set up as a Home hub so it stays awake):

1. Install Tailscale on the Apple TV and sign in.
2. In the app: **Subnet Router**, **Advertise New Route**, and enter your home range (for example `10.0.0.0/24`).
3. On the Tailscale admin page, approve the route on that machine and switch off key expiry for it.
4. Restrict access: allow your own devices to reach only `<pod-ip>` on port 3000 (and 8822 for SSH),
   not the whole home network.
5. Give the Pod a fixed address in your router, since everything now points at it.
6. Install Tailscale on the phone, switch off Wi-Fi, and open `http://<pod-ip>:3000`.

A Raspberry Pi does the same with `tailscale set --advertise-routes=10.0.0.0/24` after enabling
forwarding. A Mac can too, but the route disappears whenever it sleeps.

## B. Tailscale on the Pod

Not built yet. The plan, for whoever does it:

1. Copy Tailscale's arm64 static build to `/persistent/tailscale/` (the Pod cannot download it while blocked).
2. Run `tailscaled` in userspace mode, so it adds no routes or firewall rules of its own:
   `--tun=userspace-networking --statedir=/persistent/tailscale/state --no-logs-no-support`.
   Incoming connections are handed to Free Sleep on `127.0.0.1:3000`.
3. Keep the service file under `/persistent` and re-link it at install time, because `/etc` can be replaced.
4. Open the internet block for Tailscale's servers by address:
   - sign-in and coordination: `192.200.0.0/24`, TCP 443
   - one or two relay regions near you, TCP 443, with the others switched off in the tailnet's policy
     so the list stays short
   Relayed traffic over TCP 443 is slower than a direct link but is enough for this page.
   `ALLOW_TAILSCALE=true` in `block_internet_access.sh` today only allows Tailscale's own address
   range (100.64.0.0/10), which is needed too but is not sufficient.
5. `tailscale up --hostname=eight-pod --accept-dns=false`, sign in, then switch off key expiry for the Pod.
6. Limit access to port 3000 (and 8822) for your own devices. Never enable Funnel.

What this costs: a narrow path to the internet is reopened on a Pod that is otherwise sealed, and the
address list needs checking if remote access stops working.

## Either way

- Shortcuts keep working away from home as long as Tailscale is connected on the phone. Use the
  address from the table above in each shortcut.
- iOS allows one VPN app to connect on demand. If another VPN already does, Tailscale has to be
  switched on by hand.

## Sources

- Static install: https://tailscale.com/kb/1053/install-static
- `tailscaled` options and userspace mode: https://tailscale.com/docs/reference/tailscaled, https://tailscale.com/docs/concepts/userspace-networking
- What Tailscale needs through a firewall: https://tailscale.com/docs/reference/faq/firewall-ports
- Subnet routers, including Apple TV: https://tailscale.com/docs/features/subnet-routers, https://tailscale.com/docs/install/appletv
- Key expiry: https://tailscale.com/docs/features/access-control/key-expiry
- Names (MagicDNS): https://tailscale.com/docs/features/magicdns
- Upstream question about Tailscale on a Pod, unanswered: https://github.com/throwaway31265/free-sleep/issues/21
- Project Discord, #support and #general, March to April 2026: owners report it working on the Pod
  after opening the firewall by hand with long address lists.
