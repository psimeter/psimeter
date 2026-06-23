# PsiMeter white paper

A rigorous, two-column (IEEE-style) white paper describing the PsiMeter project and protocol —
intended for scientists reviewing the methodology and for outreach / funding. It is a **methodology
paper, not a results paper**: it describes protocol `v0.1.0-draft` and presents no data.

**Output:** [`psimeter-whitepaper.pdf`](psimeter-whitepaper.pdf) — 10 pages, 5 figures, 3 tables, 34 references.

The content is derived entirely from the normative spec in [`../spec/`](../spec/) (the protocol,
the rationale/decision log, and the test vectors). If the spec changes, update `main.typ` to match.

## Source

| File | Role |
|------|------|
| `main.typ` | The paper: abstract, sections, tables, references, figure placement. |
| `psi-template.typ` | The two-column template (adapted from `charged-ieee`): Libertinus body, sans headings, retuned for a warmer, less dense feel. |
| `figures.typ` | The five diagrams, drawn natively in [CeTZ](https://github.com/cetz-package/cetz). |
| `refs.bib` | BibTeX bibliography (rendered in IEEE numbered style). |
| `fonts/` | TeX Gyre Heros OTFs for the sans headings (body = bundled Libertinus Serif, mono = bundled DejaVu Sans Mono). |

## Build

Requires [Typst](https://typst.app) ≥ 0.15 (`winget install --id Typst.Typst`). The first build
downloads the `charged-ieee` and `cetz` packages from Typst Universe, and the fonts from CTAN.

```powershell
./build.ps1
```

or directly:

```powershell
typst compile main.typ psimeter-whitepaper.pdf --root . --font-path ./fonts
```

To iterate live: `typst watch main.typ --root . --font-path ./fonts`.

## Hosting it on the website

The Vite client serves everything in `packages/client/public/` at the site root. To make the paper
downloadable at `https://psimeter.org/psimeter-whitepaper.pdf`, drop the PDF there:

```powershell
Copy-Item psimeter-whitepaper.pdf ../packages/client/public/
```

then add a link (e.g. `<a href="/psimeter-whitepaper.pdf">Read the white paper (PDF)</a>`) wherever
you want it on the page.

## Notes

- **Fonts.** The body is **Libertinus Serif** and the mono is **DejaVu Sans Mono**, both bundled with
  Typst. The headings use **TeX Gyre Heros** (GUST Font License, freely redistributable), fetched on
  demand by `build.ps1`; commit `fonts/` if you want fully offline reproducibility.
- **Author / contact** in `main.typ` (`authors:` block): update the email/affiliation as needed.
- The template `psi-template.typ` is adapted from
  [`charged-ieee`](https://typst.app/universe/package/charged-ieee); diagrams use
  [`cetz`](https://typst.app/universe/package/cetz), pinned to an exact version in `figures.typ`.
