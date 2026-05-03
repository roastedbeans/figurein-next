## ADDED Requirements

### Requirement: Replace affordance eligibility

The system SHALL expose the replace popover only for elements judged replaceable per product rules (`icon`, `rectangle`, `circle`, `path`). The system SHALL NOT use this affordance for connector-only types where replace has no defined semantics.

#### Scenario: Replace shown for stencil-backed path

- **WHEN** the user selects a `path` element that is eligible for replacement
- **THEN** the replace trigger is available and opens the picker

#### Scenario: Replace hidden for connectors

- **WHEN** the selected element type is excluded from replacement (connectors described in editor rules)
- **THEN** no replace picker is offered for that selection

---

### Requirement: Shape band

The picker SHALL surface primitive rectangle and circle tiles plus every entry from the shared stencil catalog used by the editor. Choosing a stencil SHALL submit `pathData`, `viewBox`, and `shapeId` consistent with that catalog entry. Choosing primitives SHALL dispatch `rectangle` or `circle` templates without bespoke path data.

#### Scenario: User picks catalog stencil

- **WHEN** the user activates a stencil tile from the shapes grid
- **THEN** the store receives a `stencil` template referencing that stencil's `pathData`, `viewBox`, and stable `shapeId`

#### Scenario: User picks rectangle or circle primitive

- **WHEN** the user activates rectangle or circle
- **THEN** the store receives `rectangle` or `circle` template respectively

---

### Requirement: Icons band search and listing

The icons section SHALL provide search over the icon manifest and SHALL render at most the capped first page of hits (currently 120 results) sorted by existing search semantics. Selecting an icon SHALL dispatch `ReplaceTemplate` with `{ kind: "icon", iconId }`.

#### Scenario: Search narrows tiles

- **WHEN** the user types into the icons search control
- **THEN** rendered tiles correspond to filtered results up to the cap

#### Scenario: User selects icon

- **WHEN** the user clicks an icon tile
- **THEN** the targeted element becomes an `icon` element referencing that tile's identifier

---

### Requirement: Replace preserves layout styling

Executing a replacement SHALL keep element identity (`id`), parent/group membership, bbox (`x`, `y`, `width`, `height`), rotation, layering (`zIndex`), stroke/fill/opacity/style fields copied from `replaceElement` base payload, aspect lock, and history integration (undo/redo snapshots). Type-specific payload fields SHALL be rewritten per template rules.

#### Scenario: Replace updates content not frame

- **WHEN** a replacement completes for any supported template
- **THEN** bbox and transform-derived presentation stay consistent with pre-replace sizing unless unrelated editor actions change them afterward
