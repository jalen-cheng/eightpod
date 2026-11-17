# A stable address at home, and reaching the Pod from elsewhere

Two separate problems:

1. **At home**, the Pod's address (`10.0.0.x`) is handed out by the router and can change, which
   breaks bookmarks and phone shortcuts.
2. **Away from home**, the Pod cannot be reached at all, by design.

**Status on the test Pod 5 (17 Nov 2026):**

| | State |
|---|---|
| `.local` name | On by default. `http://eight-pod.local:3000` loads from a Mac on the home network. |
| Tailscale on the Pod | Installed and running with the internet block on. The Pod reaches Tailscale's sign-in servers and two relay regions, and nothing else (`example.com` and `github.com` time out). |
| Daily refresh of the relay addresses | Works with the block on. |
| Signing in and opening the page from a phone away from home | Signed in, and an iPhone on cellular reached the Pod through the Los Angeles relay. The page was blank at first because the server refused the app's own files under the name `eight-pod`; that is fixed (PR 44) and checked with the same request headers, but the phone has not been tried again since. |
| Reboot | Tailscale comes back signed in, and the bed's firmware starts within a minute. |

## 1. A stable address at home

| | What you do | Changes on the Pod | Weakness |
|---|---|---|---|
| **A. Use the Pod's name** (`eight-pod.local`) | Nothing: the installer switches it on | Switches on a name responder | Phone shortcuts may not look up `.local` names in every situation |
| **B. Reserve the address in the router** | One setting in the router's page or app | None | Has to be redone if you change routers |
| **C. Add a fixed second address** | Run one command on the Pod | Adds an address beside the one the router gives | You must pick an address the router will not hand to something else |

**Recommended:** use the name in the browser, and add B if your shortcuts need a number that never
changes.

### A. The Pod's name

After an install or update the Pod answers at `http://<hostname>.local:3000` on your home network,
whatever address it has. A Pod 5's hostname is `eight-pod`; run `hostname` on the Pod to check.

- It uses a responder already on the Pod (in `systemd-resolved`); nothing is installed.
- **Eight Sleep ships the Pod with this switched off**, to reduce what listens on the network.
  Free Sleep switches it back on for the home network only: the internet block allows the lookups
  to the local multicast address and nowhere else.
- To switch it off: `sh /home/dac/free-sleep/scripts/setup_local_name.sh disable`. That choice is
  remembered, so updates leave it off. Running the script with no argument switches it back on.
- Safari on iPhone and Mac looks up `.local` names. The Shortcuts app is reported to fail on them
  when a shortcut runs from a Home automation, so keep a numeric address in shortcuts unless the
  name works for you.

### B. Reserve the address in the router

In the router's admin page, find the Pod in the list of connected devices and mark its address as
reserved (also called a static lease or DHCP reservation). On an Xfinity gateway: open
`http://10.0.0.1`, **Connected Devices**, **Edit** next to the Pod, choose **Reserved IP**, save.
The Pod shows up by its hardware address, which `cat /sys/class/net/wlan0/address` prints.

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
you out, unlike a fully manual address. This one has not been tried on the test Pod.

## 2. Reaching the Pod away from home

Free Sleep's page has no login, so it must never be put straight on the open internet. Tailscale
makes a private network of your own devices; with it on the Pod and on your phone, the page opens
from anywhere and nobody else can reach it.

### Set up Tailscale on the Pod

No other device at home is needed. You need a free Tailscale account and SSH access to the Pod.

1. **Install it.** On the Pod:
   ```
   sh /home/dac/free-sleep/scripts/setup_tailscale.sh
   ```
   This downloads Tailscale, checks the download against Tailscale's published checksum, picks the
   two relay regions that answer fastest from your home, opens the internet block for those and
   for Tailscale's sign-in servers only, and starts Tailscale. The internet block is opened for
   the download and put back before the script ends.
2. **Sign the Pod in.**
   ```
   sh /home/dac/free-sleep/scripts/setup_tailscale.sh login
   ```
   It prints a link. Open it on a phone or computer and sign in to your Tailscale account.
3. **Stop the sign-in from expiring.** In the [Tailscale admin page](https://login.tailscale.com/admin/machines),
   open the menu beside the Pod and choose **Disable key expiry**. Otherwise the Pod drops off
   after about six months and has to be signed in again over SSH.
4. **Make your devices use the same relay regions as the Pod.** Run
   ```
   sh /home/dac/free-sleep/scripts/setup_tailscale.sh policy
   ```
   and paste the `"derpMap"` entry it prints into your [policy file](https://login.tailscale.com/admin/acls/file),
   beside the existing top-level entries. The Pod can only reach its two regions, so a phone that
   is travelling must use them too. Whether the page still loads without this step has not been tested.
5. **On the phone,** install Tailscale, sign in to the same account, and open
   `http://eight-pod:3000`. The same name works at home and away while Tailscale is connected, so
   it can replace the address in your shortcuts.

**One link for home and away.** The names differ by where you are: `eight-pod.local` only works at
home, and `eight-pod` only while Tailscale is connected. To use a single link everywhere:

- Leave Tailscale connected on the phone (the iOS app has "VPN On Demand") and always use `http://eight-pod:3000`; or
- Run `sh /home/dac/free-sleep/scripts/setup_tailscale.sh home-address`, approve the route it names in
  the Tailscale admin page, and always use the Pod's home address, for example `http://10.0.0.177:3000`.
  At home with Tailscale off the phone reaches it directly; with Tailscale on, at home or away, it
  goes through Tailscale. Reserve the address in the router first (part 1, B), since everything
  then points at it. Not yet tried from a phone.

Other commands:

| Command | What it does |
|---|---|
| `setup_tailscale.sh home-address` | Makes the Pod's home address reachable over Tailscale as well (see above) |
| `setup_tailscale.sh status` | Shows the connection, the regions and the relay addresses the block allows |
| `setup_tailscale.sh regions` | Lists every relay region code |
| `TAILSCALE_RELAY_REGIONS="sfo sea" sh setup_tailscale.sh` | Chooses the regions yourself |
| `setup_tailscale.sh upgrade` | Downloads the newest Tailscale and restarts it. Updating Free Sleep (`fs-update`) does this too, so it is rarely needed |
| `setup_tailscale.sh remove` | Signs out and removes everything the script added |

### How it stays locked down

| Check on the test Pod 5 | Result | Meaning |
|---|---|---|
| `iptables -m owner` | not available | The firewall cannot allow "only Tailscale". Every opening has to be a list of addresses. |
| Kernel WireGuard | not built in | Tailscale runs in userspace mode, which needs no kernel support. |
| Memory used by Tailscale | about 32 MB of 3.3 GB free | No strain on the Pod. |

- **What is opened.** TCP 80 and 443 to Tailscale's sign-in range `192.200.0.0/24`, the one range
  Tailscale documents as fixed, and TCP 443 to each relay of the chosen regions (six addresses
  for two regions). Only replies are let back in, so nothing on the internet can open a
  connection to the Pod.
- **No direct connections.** All traffic goes through a relay. That is slower than a direct link
  but plenty for this page, and it avoids opening UDP to the whole internet.
- **Userspace mode.** Tailscale adds no routes or firewall rules of its own. Connections from your
  devices are passed to the Pod's own ports, 3000 for the page and 8822 for SSH.
- **The relay list keeps itself current.** Tailscale moves relays now and then and advises against
  typing their addresses into a firewall. The relay list is served from the fixed sign-in range,
  so a daily timer on the Pod (`free-sleep-tailscale-relays.timer`) fetches it and rewrites the
  allowed addresses. If a download fails, the last good list stays.
- **Root-owned copies.** The timer runs copies of the scripts in `/persistent/tailscale/scripts`,
  because the Free Sleep folder can be changed by the unprivileged `dac` user. Updates refresh the copies.
- **Never enable Tailscale Funnel** for the Pod: it would put the page on the public internet.
- By default every device on your Tailscale account can reach the Pod. To narrow that, limit the
  Pod to ports 3000 and 8822 in the policy file's access rules.

What can still go wrong:

- Pods that installed Tailscale from the first version of the script (17 Nov 2026) booted two
  minutes slower, bed firmware included, because its unit waited for a network service the Pod
  does not use. Updating Free Sleep rewrites the unit.
- If Tailscale ever changes its sign-in range, the Pod loses remote access until the range in
  `block_internet_access.sh` is updated. Home access is not affected.
- A firmware update from Eight Sleep may remove the files under `/etc`. Re-run
  `setup_tailscale.sh`; the sign-in is kept in `/persistent/tailscale/state`.
- iOS lets one VPN app connect on demand. If another already does, Tailscale has to be switched on by hand.

### Alternatives

| Option | What gets opened in the internet block | Page stays private? | Why not the default |
|---|---|---|---|
| **Tailscale on another always-on device** (Apple TV as a Home hub, Raspberry Pi, some routers) | Nothing | Yes | Needs that other device. The Pod stays fully sealed, so it is the tightest option if you have one. |
| **Cloudflare Tunnel with Access** | Port 7844 to 20 fixed Cloudflare addresses | No: it gets a public web address, with Cloudflare's login as the only gate | Public address, and it needs a domain (about $10 a year) |
| **WireGuard on the Pod with a port forward** | Nothing outbound | Yes | A port forward in the router, your home's changing public address to track, and a userspace WireGuard to build |
| **ZeroTier** | UDP to servers whose addresses change | Yes | It has no web-port fallback for a locked-down firewall |
| **Your own relay on a rented server** | One fixed address | Yes | The only way to get a relay address that never changes, but it is another machine to pay for and run |

With another always-on device, install Tailscale there and advertise your home range as a subnet
route (Apple TV: **Subnet Router**, **Advertise New Route**, for example `10.0.0.0/24`), approve the
route in the admin page, switch off key expiry for that device, and reserve the Pod's address
(part 1, B). Its weakness: it fails when you are on another network that uses the same range as
home, and `10.0.0.x` is common.

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
