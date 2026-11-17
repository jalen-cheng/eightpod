# A stable address at home, and reaching the Pod from elsewhere

Two separate problems:

1. **At home**, the Pod's address (`10.0.0.x`) is handed out by the router and can change, which
   breaks bookmarks and phone shortcuts.
2. **Away from home**, the Pod cannot be reached at all, by design.

**Status:** the name script in part 1 is written but has not yet been run on a Pod. Part 2 is
research: nothing in it is set up or tested. Sources are at the bottom.

## 1. A stable address at home

Pick one. They can be combined.

| | What you do | Changes on the Pod | Weakness |
|---|---|---|---|
| **A. Reserve the address in the router** | One setting in the router's page or app | None | Has to be redone if you change routers |
| **B. Give the Pod a name** (`eight-pod.local`) | Run one script on the Pod | Switches on a name responder | Phone shortcuts may not look up `.local` names in every situation |
| **C. Add a fixed second address** | Run one command on the Pod | Adds an address beside the one the router gives | You must pick an address the router will not hand to something else |

**Recommended:** A if you can get into the router, since nothing on the Pod changes. B if you
cannot, or as well as A so the app has a name you can remember.

### A. Reserve the address in the router

In the router's admin page, find the Pod in the list of connected devices and mark its address as
reserved (also called a static lease or DHCP reservation). On an Xfinity gateway: open
`http://10.0.0.1`, **Connected Devices**, **Edit** next to the Pod, choose **Reserved IP**, save.
The Pod shows up by its hardware address, which `cat /sys/class/net/wlan0/address` prints.

### B. Give the Pod a name

Over SSH on the Pod:

```
sh /home/dac/free-sleep/scripts/setup_local_name.sh
```

The Pod then answers at `http://eight-pod.local:3000` on your home network, whatever address it
has. If the internet block is on, run `sh /home/dac/free-sleep/scripts/block_internet_access.sh`
once afterwards so the block lets the name lookups through. To undo it:
`sh /home/dac/free-sleep/scripts/setup_local_name.sh disable`.

Things to know:

- It uses a responder already on the Pod (in `systemd-resolved`); nothing is installed and Wi-Fi is
  not restarted.
- **Eight Sleep ships the Pod with this switched off on purpose**, to reduce what listens on the
  network. The script switches it back on for the home network only, which is why it is something
  you run rather than part of the installer.
- Safari on iPhone and Mac looks up `.local` names. The Shortcuts app is reported to fail on them
  when a shortcut runs from a Home automation, so keep the numeric address in shortcuts unless
  the name works for you.

### C. Add a fixed second address

NetworkManager can keep asking the router for an address and also hold one you choose:

```
nmcli connection modify customer-wifi +ipv4.addresses 10.0.0.254/24
nmcli connection up customer-wifi
```

The second command restarts Wi-Fi, so an SSH session will drop for a few seconds. The Pod then
answers on both addresses. Choose one the router will never give out: on an Xfinity gateway the
pool is usually `10.0.0.2` to `10.0.0.253`, which leaves `.254`; check that nothing answers there
first (`ping 10.0.0.254`). Because the router's address is kept as well, a wrong choice cannot lock
you out, unlike a fully manual address.

## 2. Reaching the Pod away from home

Free Sleep's page has no login, so it must never be put straight on the open internet.

### What the Pod allows

| Check on the test Pod 5 | Result | Meaning |
|---|---|---|
| Processor, space, memory | arm64, 13 GB free on `/persistent`, 3.3 GB free memory | Any of the tools below fits. |
| `/dev/net/tun` | present | Tools that need a tunnel device can run. |
| Kernel WireGuard | not built in | A userspace version is needed. |
| `iptables -m owner` | **not available** | The firewall cannot allow "only this program". Every hole has to be a list of addresses. |
| Host check in Free Sleep | none | The page answers under any name. |

### With no other device at home

| Option | What gets opened in the internet block | Page stays private? | Effort |
|---|---|---|---|
| **Tailscale on the Pod, relayed** | TCP 443 to Tailscale's sign-in range (`192.200.0.0/24`) and to the 6 to 9 addresses of two or three relay regions | Yes, only your own devices | About an hour, plus refreshing the relay addresses when they change |
| **Cloudflare Tunnel with Access** | Port 7844 to 20 fixed Cloudflare addresses | No: it gets a public web address, with Cloudflare's login as the only gate | About an hour; needs a domain (about $10 a year) |
| **WireGuard on the Pod with a port forward** | Nothing outbound | Yes | Most work: a port forward in the router, your home's changing public address to track, and a userspace WireGuard to build |
| **ZeroTier** | UDP to servers whose addresses change | Yes | Poor fit: it has no web-port fallback for a locked-down firewall |

**Recommended: Tailscale on the Pod, relayed.** The plan, for whoever sets it up:

1. Copy Tailscale's arm64 static build to `/persistent/tailscale/` (the Pod cannot download it while blocked).
2. Run `tailscaled --tun=userspace-networking --statedir=/persistent/tailscale/state --no-logs-no-support`.
   In this mode it adds no routes or firewall rules of its own, and hands incoming connections to
   Free Sleep on port 3000.
3. In the tailnet's policy file, switch off every relay region except two or three near you, so the
   list of addresses is short:
   ```json
   "derpMap": { "regions": { "1": null, "3": null } }
   ```
   (one entry per region to switch off; the region numbers are in the relay map linked below).
4. Open the internet block for TCP 443 to `192.200.0.0/24` and to those regions' addresses from the
   relay map. `ALLOW_TAILSCALE=true` today only allows Tailscale's own range (`100.64.0.0/10`),
   which is needed as well but is not enough; the block script would need this list added.
5. `tailscale up --hostname=eight-pod --accept-dns=false`, sign in, then switch off key expiry for the Pod.
6. Limit access to port 3000 (and 8822 for SSH) to your own devices. Never enable Funnel.
7. On the phone, install Tailscale and use `http://eight-pod.<your-tailnet>.ts.net:3000`. That name
   works at home and away, so it also solves part 1.

What it costs: Tailscale advises against listing relay addresses because they change over time, so
this needs a refresh now and then, and all traffic goes through a relay, which is slower than a
direct link but plenty for this page. The Pod can then reach those Tailscale servers, and nothing else.

### With another always-on device at home

If there is an Apple TV (set up as a Home hub), a Raspberry Pi, or a router with Tailscale built in,
it can relay instead and the Pod stays fully sealed:

1. Install Tailscale on that device and advertise your home range as a subnet route
   (Apple TV: **Subnet Router**, **Advertise New Route**, for example `10.0.0.0/24`).
2. Approve the route on the Tailscale admin page and switch off key expiry for that device.
3. Restrict access to the Pod's address on port 3000 (and 8822), not the whole home network.
4. Reserve the Pod's address (part 1, A), since everything now points at it.

Its weakness: it fails when you are on another network that uses the same range as home, and
`10.0.0.x` is common.

### Either way

- Shortcuts keep working away from home while Tailscale is connected on the phone.
- iOS lets one VPN app connect on demand. If another already does, Tailscale has to be switched on by hand.

## Sources

- What Tailscale needs through a firewall, and its advice on address lists: https://tailscale.com/kb/1082/firewall-ports
- Relay map with every region's addresses: https://login.tailscale.com/derpmap/default
- Switching relay regions off in the policy file: https://tailscale.com/kb/1232/derp-servers
- Static install and userspace mode: https://tailscale.com/kb/1053/install-static, https://tailscale.com/kb/1112/userspace-networking
- Incoming connections in userspace mode reach local ports: https://github.com/tailscale/tailscale/issues/5068
- Subnet routers, including Apple TV: https://tailscale.com/docs/features/subnet-routers, https://tailscale.com/docs/install/appletv
- Cloudflare Tunnel behind a firewall, and tokens for scripts: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/, https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
- ZeroTier and firewalls: https://docs.zerotier.com/corporate-firewalls/
- The name responder's two settings: https://www.freedesktop.org/software/systemd/man/latest/resolved.conf.html, https://networkmanager.dev/docs/api/latest/nm-settings-nmcli.html
- Shortcuts and `.local` names: https://developer.apple.com/forums/thread/665899
- A fixed address beside the router's: https://lists.gnome.org/archives/networkmanager-list/2015-September/msg00077.html
- Xfinity address reservation and port forwarding: https://forums.xfinity.com/conversations/your-home-network/how-do-i-assign-a-static-ip-address-to-a-device-on-my-network/61db98bae41a4a46af430460, https://www.xfinity.com/support/articles/port-forwarding-xfinity-wireless-gateway
- Upstream question about Tailscale on a Pod, unanswered: https://github.com/throwaway31265/free-sleep/issues/21
