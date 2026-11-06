"""Side-by-side composite and value/colour metrics for a reference image and a render.

usage: python3 compare.py REF RENDER [--out PNG] [--height 540] [--ignore-bottom 0.12]
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageStat

METAVERSE = Path(__file__).resolve().parents[4]
LANCZOS = getattr(getattr(Image, 'Resampling', Image), 'LANCZOS')
MEDIANCUT = getattr(getattr(Image, 'Quantize', Image), 'MEDIANCUT')
# Heuristic thresholds for "still open" differences. Tune per room if needed.
LIMITS = {'mean': 15, 'contrast': 10, 'shadows': .15, 'highlights': .10, 'saturation': .08, 'warmth': 12}
GRID_LIMIT = 30


def resolve(name):
    path = Path(name).expanduser()
    if path.is_absolute() or path.exists():
        return path
    return METAVERSE / path


def analyse(image, ignore_bottom):
    if ignore_bottom > 0:  # e.g. burned-in captions in reference video frames
        image = image.crop((0, 0, image.width, round(image.height * (1 - ignore_bottom))))
    small = image.copy()
    small.thumbnail((320, 320))
    luma = small.convert('L')
    hist = luma.histogram()
    total = sum(hist)

    def percentile(q):
        running = 0
        for value, count in enumerate(hist):
            running += count
            if running >= q * total:
                return value
        return 255

    stat = ImageStat.Stat(luma)
    w, h = luma.size
    grid = [[ImageStat.Stat(luma.crop((c * w // 3, r * h // 3, (c + 1) * w // 3, (r + 1) * h // 3))).mean[0]
             for c in range(3)] for r in range(3)]
    red, _, blue = ImageStat.Stat(small).mean
    quantized = small.quantize(colors=6, method=MEDIANCUT)
    palette = quantized.getpalette()
    colours = [('#%02x%02x%02x' % tuple(palette[i * 3:i * 3 + 3]), count / total)
               for count, i in sorted(quantized.getcolors(), reverse=True)]
    return {
        'mean': stat.mean[0], 'contrast': stat.stddev[0],
        'p10': percentile(.1), 'p50': percentile(.5), 'p90': percentile(.9),
        'shadows': sum(hist[:64]) / total, 'highlights': sum(hist[192:]) / total,
        'saturation': ImageStat.Stat(small.convert('HSV')).mean[1] / 255, 'warmth': red - blue,
        'grid': grid, 'palette': colours,
    }


def composite(ref, render, height, out):
    def fit(image):
        return image.resize((max(1, round(image.width * height / image.height)), height), LANCZOS)
    left, right = fit(ref), fit(render)
    band, gap = 28, 12
    sheet = Image.new('RGB', (left.width + gap + right.width, height + band), (18, 18, 18))
    sheet.paste(left, (0, band))
    sheet.paste(right, (left.width + gap, band))
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 8), 'REFERENCE', fill=(235, 235, 235))
    draw.text((left.width + gap + 8, 8), 'RENDER', fill=(235, 235, 235))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('ref')
    parser.add_argument('render')
    parser.add_argument('--out')
    parser.add_argument('--height', type=int, default=540)
    parser.add_argument('--ignore-bottom', type=float, default=0.0,
                        help='metrics ignore this bottom fraction of both images (captions)')
    args = parser.parse_args()

    ref_path, render_path = resolve(args.ref), resolve(args.render)
    ref, render = Image.open(ref_path).convert('RGB'), Image.open(render_path).convert('RGB')
    out = resolve(args.out) if args.out else render_path.with_name(f'{render_path.stem}-vs-ref.png')
    composite(ref, render, args.height, out)
    a, b = analyse(ref, args.ignore_bottom), analyse(render, args.ignore_bottom)

    print(f'composite: {out}')
    ref_aspect, render_aspect = ref.width / ref.height, render.width / render.height
    note = '' if abs(ref_aspect - render_aspect) < .02 else '  ← 비율이 달라요. snap에 --ref나 --size를 주고 다시 찍으세요.'
    print(f'aspect: ref {ref_aspect:.3f} · render {render_aspect:.3f}{note}')
    print(f'\n{"metric":<22}{"ref":>9}{"render":>9}{"Δ":>9}')
    rows = [('mean luma', 'mean', '{:.0f}'), ('contrast (luma std)', 'contrast', '{:.0f}'),
            ('p10 / dark', 'p10', '{:.0f}'), ('p50 / median', 'p50', '{:.0f}'), ('p90 / bright', 'p90', '{:.0f}'),
            ('shadows <64', 'shadows', '{:.2f}'), ('highlights >192', 'highlights', '{:.2f}'),
            ('saturation', 'saturation', '{:.2f}'), ('warmth (R−B)', 'warmth', '{:.0f}')]
    open_items = []
    for label, key, fmt in rows:
        delta = b[key] - a[key]
        flag = ' *' if key in LIMITS and abs(delta) > LIMITS[key] else ''
        if flag:
            open_items.append(label)
        delta_text = ('+' if delta >= 0 else '') + fmt.format(delta)
        print(f'{label:<22}{fmt.format(a[key]):>9}{fmt.format(b[key]):>9}{delta_text:>9}{flag}')
    print('\n3×3 mean luma (ref | render | Δ)')
    for r in range(3):
        deltas = [b['grid'][r][c] - a['grid'][r][c] for c in range(3)]
        if any(abs(d) > GRID_LIMIT for d in deltas):
            open_items.append(f'grid row {r + 1}')
        ref_cells = ' '.join(f'{v:4.0f}' for v in a['grid'][r])
        render_cells = ' '.join(f'{v:4.0f}' for v in b['grid'][r])
        print(f'  {ref_cells} | {render_cells} | {" ".join(f"{d:+4.0f}" for d in deltas)}')
    print('\npalette (share)')
    for name, data in (('ref', a), ('render', b)):
        print(f'  {name:<7}' + '  '.join(f'{colour} {share:.0%}' for colour, share in data['palette']))
    print('\nopen (heuristic): ' + (', '.join(open_items) if open_items else '없음 — 그래도 이미지를 직접 보고 판단하세요'))


if __name__ == '__main__':
    main()
