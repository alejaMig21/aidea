# What a deployment or network drawing contains

Researched 2026-11-03 for topic 5 (networking and deployment). Web pages read that day; no formal standard (IEEE, TIA) was found or checked.

## C4 deployment diagram ([c4model.com](https://c4model.com/diagrams/deployment))
- **Deployment node:** where an instance of a container or system runs: hardware, virtual infrastructure, a container environment or an execution environment such as an application server. Nodes nest.
- **Infrastructure node:** supporting elements that are not where your own code runs: DNS, load balancers, firewalls.
- **Container instance:** one running copy of a container from the Architecture layer, inside a node. Several copies can be shown for redundancy.
- **Scope:** one deployment environment at a time (production, staging...).
- Fits the existing Architecture schema: `parent` already means "is inside".

## Network diagrams, as network engineers draw them
Sources: [graphicalnetworks.com](https://graphicalnetworks.com/blog-logical-vs-physical-network-diagrams/), [Creately](https://static2.creately.com/guides/logical-vs-physical-topology/).
- **Physical:** devices and the cables between them; racks, rooms, buildings and sites; which switch port connects to what.
- **Logical:** how data moves; VLAN ids, subnets, names, network address and mask. Most drawn diagrams are layer 3 (the network layer), where layer 2 switches do not appear. IPv6 may get its own diagram.
- A logical diagram can hide physical details, so it can be shared without exposing them.

## Reading for aidea
Three levels of increasing network detail: (1) C4-style deployment (nodes, infrastructure nodes, instances, environments); (2) logical network (subnets, VLANs, addresses, firewall rules); (3) physical (racks, ports, cables). The person is not a network engineer and wants to support that profile; the notation per layer follows what those engineers already use.
