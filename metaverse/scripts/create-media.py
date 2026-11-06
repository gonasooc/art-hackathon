"""Reproducible temporary artworks. Requires ffmpeg; no source media or Python packages."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'films'
OUT.mkdir(parents=True, exist_ok=True)
DURATION = 12

def render(name, shader, sound):
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', f'nullsrc=s=960x540:r=24:d={DURATION},{shader}',
        '-f', 'lavfi', '-i', f'aevalsrc={sound}:s=44100:d={DURATION}',
        '-vf', 'format=yuv420p,fade=t=in:st=0:d=1,fade=t=out:st=11:d=1',
        '-af', 'afade=t=in:st=0:d=1.5,afade=t=out:st=10:d=2',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-c:a', 'aac',
        '-b:a', '128k', '-movflags', '+faststart', '-shortest', str(OUT / name),
    ], check=True)

beam = 'exp(-pow((X/W-0.5-0.18*sin(5*Y/H+T*0.6))*22,2))'
halo = 'exp(-pow((X/W-0.5-0.18*sin(5*Y/H+T*0.6))*5,2))'
render('resonance.mp4', f"geq=r='12+160*{beam}+50*{halo}':g='14+110*{beam}+24*{halo}':b='14+55*{beam}+8*{halo}'",
       '0.055*sin(2*PI*146.83*t)+0.025*sin(2*PI*220*t)*(0.6+0.4*sin(2*PI*0.15*t))')
wave = 'pow(0.5+0.5*sin(hypot((X-W/2)*0.7,Y-H/2)*0.065-T*1.5),8)'
fall = 'exp(-hypot(X-W/2,Y-H/2)/420)'
render('afterimage.mp4', f"geq=r='10+38*{wave}*{fall}':g='20+120*{wave}*{fall}':b='24+145*{wave}*{fall}'",
       '0.045*sin(2*PI*174.61*t)+0.025*sin(2*PI*261.63*t)*(0.5+0.5*sin(2*PI*0.2*t))')
subprocess.run([
    'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=black:s=32x32:r=24:d=0.25',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-t', '0.25', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    '-movflags', '+faststart', str(OUT / 'ready.mp4'),
], check=True)
print('Created two 12-second original audiovisual studies and an audio-permission priming clip.')
