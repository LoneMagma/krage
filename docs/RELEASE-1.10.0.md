# KRAGE 1.10.0: Dune and Snow

Combined map pass; the character work originally planned for 1.10 already shipped with 1.9.

## Routes
Dune retains its 72 x 60 footprint, twelve spawn pockets and accessible terraces. The central solid block becomes an L-shaped utility courtyard. Offset openings connect the shaded service lane north and south; a redundant market wall and counter are removed. Reservoir equipment provides purposeful terrace cover. Existing pipe skill-jump and underpasses remain.

Snow retains its 64 x 72 footprint and four warehouse entrances. An exterior staircase, catwalk and elevated maintenance door add a third gallery approach, with a ground route underneath. The southern tunnel becomes an open maintenance yard with offset equipment. Low snow banks define the eastern route. Internal stairs, spawn exits and freight cover remain usable. Neither Cell layout changes.

The map previews now derive solids from shared collision geometry and use distinct biome colors, route surfaces and landmark symbols.

## Materials and rendering
Softer mineral plaster and worn paving in Dune; ribbed insulated cladding, less harsh metal seams, subtle drift patterns and warmer warehouse fixtures in Snow. Visual route surfaces remain flush. Substantial additions use the shared block collision source.

Removed overlapping coplanar Snow deck sections. Floor overlays use polygon offset, deterministic render order and no depth writes; they no longer cast floating shadows. Lighting is less washed out. High quality uses a 2048 directional shadow map with bounds based on arena dimensions, replacing the cropped fixed frustum. Lower quality tiers still disable dynamic shadows. No new point lights or runtime texture downloads.

Measured static geometry in the headless renderer: Dune 83 meshes / 11,282 triangles; Snow 63 meshes / 6,724 triangles. Browser labels can add a few material draws. These are geometry counts, not certified FPS benchmarks.

## Verification and deployment
127 core/presentation tests plus 38 room tests cover spawn clearance, navigation, actual standing-collider stair traversal, gallery connection, existing skill jumps, material depth settings and non-overlapping deck surfaces. Both overview renders were inspected. Lint, TypeScript and the production build pass. A live human match is still needed to judge route popularity, spawn pressure and weapon balance; no playtest telemetry is implied.

Deploy frontend AND room server together: ROOM_PROTOCOL is now 23 because collision layouts changed. Retain existing account/environment configuration and persistence. No account migration or new dependency. Source ZIP excludes secrets and build caches.
