# Pixmage sounds: soft 8-bit chirps (triangle and sine, low-passed, short) that sit under lofi music.
# usage: python3 sounds/make.py sounds
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter
SR = 24000; OUT = sys.argv[1]
t_ = lambda d: np.arange(int(SR * d)) / SR
def env(n, a=.004, d=.08): t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)
def lp(x, f): b, a = butter(2, f / (SR / 2)); return lfilter(b, a, x)
def tri(f, d): ph = np.cumsum(np.broadcast_to(f, int(SR * d)) / SR) % 1; return 4 * np.abs(ph - .5) - 1
sine = lambda f, d: np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, int(SR * d)) / SR))
def seq(parts):
    out = np.zeros(int(SR * max(at + len(x) / SR for at, x in parts)) + 1)
    for at, x in parts: i = int(SR * at); out[i:i + len(x)] += x
    return out
def save(name, x, peak):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    f = min(len(x), int(SR * .01)); x[-f:] *= np.linspace(1, 0, f)  # no click at the end
    wavfile.write(f'{OUT}/{name}.wav', SR, (x * 32767).astype(np.int16))
note = lambda n: 440 * 2 ** ((n - 69) / 12)  # MIDI number to Hz
def blip(n, d=.07, dec=.035, cut=2400): return lp(tri(note(n), d) * .7 + sine(note(n), d) * .3, cut) * env(int(SR * d), .004, dec)
# a monster walks in: a small rising "pip-pip"
save('spawn', seq([(0, blip(74) * .7), (.07, blip(79))]), .6)
# a monster falls: a soft "pop", a sine dropping in pitch
d = .14; f = 520 * np.exp(-t_(d) * 16) + 180
save('defeat', lp(sine(f, d), 1600) * env(int(SR * d), .003, .045), .6)
# level up: C-E-G-C climbing, gently
arp = [(i * .08, blip(n, .1, .06)) for i, n in enumerate([72, 76, 79])]
d = .45; vib = note(84) * (1 + .008 * np.sin(2 * np.pi * 5 * t_(d)))
save('levelup', seq(arp + [(.24, lp(tri(vib, d) * .6 + sine(vib, d) * .4, 2600) * env(int(SR * d), .006, .18))]), .6)
# refused: two low notes falling, muffled
save('refused', seq([(0, blip(57, .1, .06, 900)), (.12, blip(52, .16, .08, 900))]), .55)
# turn done: a soft two-note bell
bell = lambda n, d=.45: lp(sine(note(n), d) + .2 * tri(note(n + 12), d), 2400) * env(int(SR * d), .004, .14)
save('done', seq([(0, bell(79) * .8), (.12, bell(84))]), .55)
# focus timer done: three soft music-box notes, once, slow and quiet (about 1.4 s)
box = lambda n, d=.9: lp(sine(note(n), d) + .15 * sine(note(n + 12), d), 2200) * env(int(SR * d), .006, .3)
save('pomodoro', seq([(0, box(79)), (.28, box(84)), (.56, box(88))]), .45)
