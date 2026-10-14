# Third-party notices

EarthPrints is licensed under the Apache License 2.0 (see `LICENSE`). The colour maps used by the fingerprint plot come from the sources below, under their own licences.

## Scientific colour maps (Fabio Crameri)

Used for vik, berlin, broc, lisbon, cork, tofino, bam, vanimo, roma and managua, in `src/lib/map/colormapTables.ts`. The tables are the official 256-entry tables from version 8.0.0, downsampled to 33 stops. The dark-centred maps (berlin, lisbon, tofino, vanimo, managua) are modified: their centre is shifted onto the app's dark panel colour, and the shift fades out linearly toward both ends.

- Source: Crameri, F. (2023). *Scientific colour maps* (8.0.0). Zenodo. https://doi.org/10.5281/zenodo.8035877
- Website: https://www.fabiocrameri.ch/colourmaps/
- Licence: MIT

Further reading: Crameri, F., Shephard, G. E. and Heron, P. J. (2020). The misuse of colour in science communication. *Nature Communications*, 11, 5444. https://doi.org/10.1038/s41467-020-19160-7

```
MIT License

Copyright (c) Fabio Crameri

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ColorBrewer (Cynthia A. Brewer)

Used for RdBu, in `src/lib/map/colormapTables.ts`, reversed so blue is negative.

- Source: Brewer, C. A. ColorBrewer 2.0. https://colorbrewer2.org
- Repository: https://github.com/axismaps/colorbrewer
- Licence: Apache License 2.0 (the same licence as EarthPrints, full text in `LICENSE`)

## CET perceptually uniform colour maps (Peter Kovesi)

Used for Flux, in `src/lib/map/fingerprintScale.ts`: `linear_kbc_5_95_c73` for uptake and reversed `linear_kryw_5_100_c67` for release, taken from the colorcet package.

- Source: Kovesi, P. (2015). Good colour maps: how to design them. arXiv:1509.03700. https://arxiv.org/abs/1509.03700
- Website: https://colorcet.com
- Package: colorcet (HoloViz), https://github.com/holoviz/colorcet
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
