Images used on the plain-resume view:

- `minesweeper-project.gif` — screenshot/gif under the Minesweeper AI & Analytics Platform project
- `clue-project.png` — gameplay screenshot under the Clue project

The De-Bug project uses an embedded YouTube video instead of an image (see
`index.html`, the `.video-embed` block), with a plain "watch on YouTube"
link underneath as a fallback in case the embed doesn't load.

There's no profile photo slot anymore — the top of the resume view is now
an "About Me" text section you can edit directly in `index.html` (look for
the `about-me` div).

Both `<img>` tags have `onerror` handlers that hide the image if the file
is ever missing or renamed, so nothing breaks if you swap these out. To
replace either image, just overwrite the file with a new image of the same
name, or update the `src` in `index.html` to point at a new filename.
