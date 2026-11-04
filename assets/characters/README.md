# Character portraits

Optional. Without images the app draws each character's initial in their colour, so nothing is broken.

## Files per character

```
assets/characters/<id>/default.webp      main portrait (required if you add any)
assets/characters/<id>/happy.webp        happy / playful / encouraging
assets/characters/<id>/surprised.webp    surprised
assets/characters/<id>/thinking.webp     curious
assets/characters/<id>/focused.webp      focused
assets/characters/<id>/empathetic.webp   empathetic
```

`<id>` is `emma`, `james`, `mika`, `david`, `sofia` or `alex`.

- Square, at least 256×256, WebP, under 60 KB each.
- One consistent fictional person per character; every expression must look like the same person.
- Use only images you created or have the rights to. No photos of real people.

## Turning them on

After adding files, list the ones that exist in `js/engine/characters.js`, for example:

```js
avatar: { emoji: '🧡', color: '#f08a5d', available: ['default', 'happy', 'thinking'] },
```

Missing expressions fall back to `default.webp`, then to the drawn initial. Then add the files
to `SHELL` in `sw.js` if they should work offline, and bump `CACHE`.
