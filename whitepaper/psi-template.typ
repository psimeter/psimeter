// ============================================================
// Local two-column paper template for the PsiMeter white paper.
//
// Adapted from `charged-ieee` (v0.1.3, MIT, by the Typst authors): the IEEE
// two-column skeleton is kept, but the typography is retuned for a warmer,
// less dense, ACM-like feel — Libertinus Serif body, TeX Gyre Heros (sans)
// headings, larger line-leading, and a wider column gutter.
// ============================================================
#let paper(
  title: [Paper Title],
  authors: (),
  abstract: none,
  index-terms: (),
  paper-size: "us-letter",
  bibliography: none,
  figure-supplement: [Fig.],
  body,
) = {
  set document(title: title, author: authors.map(a => a.name))

  // Body type: Libertinus Serif (a Linux Libertine fork bundled with Typst).
  set text(font: "Libertinus Serif", size: 9.9pt)

  set enum(numbering: "1)a)i)")

  // Tables & figures
  show figure: set block(spacing: 15.5pt)
  show figure: set place(clearance: 15.5pt)
  show figure.where(kind: table): set figure.caption(position: top)
  show figure.where(kind: table): set text(size: 8pt)
  show figure.where(kind: table): set figure(numbering: "I")
  show figure.where(kind: image): set figure(supplement: figure-supplement, numbering: "1")
  show figure.caption: set text(size: 8.2pt)
  show figure.caption: set align(start)
  show figure.caption.where(kind: table): set align(center)
  show figure: fig => {
    let prefix = (
      if fig.kind == table [TABLE]
      else if fig.kind == image [Fig.]
      else [#fig.supplement]
    )
    let numbers = numbering(fig.numbering, ..fig.counter.at(fig.location()))
    show figure.caption: it => [#prefix~#numbers: #it.body]
    show figure.caption.where(kind: table): smallcaps
    fig
  }

  // Inline / block code: a clean bundled mono.
  show raw: set text(font: "DejaVu Sans Mono", ligatures: false, size: 0.84em)

  // Page & columns. A slightly wider gutter than IEEE for more air.
  set columns(gutter: 15pt)
  set page(
    columns: 2,
    paper: paper-size,
    margin: if paper-size == "a4" {
      (x: 41.5pt, top: 80.51pt, bottom: 89.51pt)
    } else {
      (
        x: (50pt / 216mm) * 100%,
        top: (55pt / 279mm) * 100%,
        bottom: (64pt / 279mm) * 100%,
      )
    },
  )

  set math.equation(numbering: "(1)")
  show math.equation: set block(spacing: 0.7em)

  show ref: it => {
    if it.element != none and it.element.func() == math.equation {
      link(it.element.location(), numbering(
        it.element.numbering,
        ..counter(math.equation).at(it.element.location()),
      ))
    } else {
      it
    }
  }

  set enum(indent: 10pt, body-indent: 9pt)
  set list(indent: 10pt, body-indent: 9pt)

  // Headings: sans (TeX Gyre Heros), IEEE numbering kept so in-text
  // cross-references stay valid.
  set heading(numbering: "I.A.a)")
  show heading: it => {
    let levels = counter(heading).get()
    let deepest = if levels != () { levels.last() } else { 1 }

    set text(10pt, weight: 400, font: "TeX Gyre Heros")
    if it.level == 1 {
      let is-ack = it.body in ([Acknowledgment], [Acknowledgement], [Acknowledgments], [Acknowledgements])
      set align(center)
      set text(if is-ack { 9.5pt } else { 10.5pt }, weight: 600)
      show: block.with(above: 17pt, below: 12pt, sticky: true)
      show: smallcaps
      if it.numbering != none and not is-ack {
        numbering("I.", deepest)
        h(7pt, weak: true)
      }
      it.body
    } else if it.level == 2 {
      set par(first-line-indent: 0pt)
      set text(weight: 600)
      show: block.with(above: 11pt, below: 8pt, sticky: true)
      if it.numbering != none {
        numbering("A.", deepest)
        h(7pt, weak: true)
      }
      it.body
    } else [
      #if it.level == 3 {
        numbering("a)", deepest)
        [ ]
      }
      #text(font: "Libertinus Serif", style: "italic")[#(it.body):]
    ]
  }

  // Bibliography
  show std.bibliography: set text(8.2pt)
  show std.bibliography: set block(spacing: 0.55em)
  set std.bibliography(title: text(10.5pt)[References], style: "ieee")

  // Title & author block (spans both columns).
  place(
    top,
    float: true,
    scope: "parent",
    clearance: 26pt,
    {
      v(3pt, weak: true)
      align(center, par(leading: 0.5em, text(size: 20pt, weight: 600, title)))
      v(7.5mm, weak: true)

      set par(leading: 0.5em)
      for i in range(calc.ceil(authors.len() / 3)) {
        let end = calc.min((i + 1) * 3, authors.len())
        let is-last = authors.len() == end
        let slice = authors.slice(i * 3, end)
        grid(
          columns: slice.len() * (1fr,),
          gutter: 12pt,
          ..slice.map(author => align(center, {
            text(size: 11pt, author.name)
            if "department" in author [ \ #emph(author.department) ]
            if "organization" in author [ \ #emph(author.organization) ]
            if "location" in author [ \ #author.location ]
            if "email" in author {
              if type(author.email) == str [ \ #link("mailto:" + author.email) ]
              else [ \ #author.email ]
            }
          })),
        )
        if not is-last { v(16pt, weak: true) }
      }
    },
  )

  // Abstract & index terms, with a touch more line-leading than IEEE.
  set par(spacing: 0.5em, justify: true, first-line-indent: 1em, leading: 0.52em)
  if abstract != none [
    #set text(9pt)
    #set par(leading: 0.58em)
    #text(weight: 700)[#h(1em)_Abstract_---]#h(weak: true, 0pt)#abstract

    #if index-terms != () [
      #v(2pt)
      #text(weight: 700)[#h(.3em)_Index Terms_---]#h(weak: true, 0pt)#index-terms.join(", ")
    ]
    #v(3pt)
  ]

  // Body: open leading to reduce the dense feel.
  set par(leading: 0.62em, spacing: 0.62em)
  body

  bibliography
}
