# Ghost — web edition

The watch app's Ghost pace clock, rebuilt for a phone propped at the poolside.
Four files, no build step, no dependencies, no network.

```
index.html            the whole app — markup, styles, engine, face
manifest.webmanifest  makes "Add to Home Screen" launch it fullscreen
sw.js                 caches the app so a pool with no signal still works
icon-1024.png         the master — the same artwork as the iOS app icon
icon-192.png
icon-512.png
icon-maskable-512.png padded, for launchers that crop to their own shape
tools/make_icons.sh   regenerates the three from the master
tools/test_web_ghost.js
```

## What it is, and what it isn't

The watch reads Apple's pool-length events and works out afterwards how the swim
went. A phone reads nothing, so this runs **blind**: the ghost swims its schedule
on the wall clock and the swimmer races it. There is no lap detection, no heart
rate, no verdict, no history.

Two consequences follow, and they are the only deliberate departures from the
watch:

- **The rest is a duration you pick**, not a heart-rate gate. It runs unbroken
  to 1: the watch swaps a REST screen for a 5,4,3,2,1 release because it can't
  know how long a heart-rate gate will take, and here there is nothing to swap
  to. REST takes the box at the top of the dial.

There is **one number, in one place**, whatever is being counted — the 5,4,3,2,1
into the session, the seconds left of the lap while you're swimming, the seconds
left of the rest while you're standing. It never moves and never resizes, so the
thing you glance at is always where you last looked.
- **The level is answered, not measured.** The watch moves you up the ladder
  when all three reps land on target. There is nothing here to measure, so at
  the end of a session it asks — *held the ghost?* — and a tick steps the rung.
  You can also just set it yourself on the setup screen.

## What it remembers

Target, rest and level are kept in the browser's local storage, so the app opens
where you left it and a level earned at the end of a swim is there next time.

That storage belongs to **one browser at one address**. Clearing site data wipes
it, a different browser starts fresh, and — worth settling before anyone builds
up a habit — **changing the site's URL is a new address and starts over**. A
`?baseline=` land test deliberately writes nothing, so it can't leave a
15-second ghost behind as your target.

Everything else is the watch face: the arm sweeping one revolution per 50m lap,
the pale next-lap stub waiting at 12 in its tier's colour, the thin marks showing
where a faster gear would close, and the 2/4/4 pip rows resetting at each gear
change.

## The session

```
5 laps warmup → rest → rep → rest → rep → rest → rep → rest → 5 laps cooldown
```

A rep is 10 laps split 2 / 4 / 4, one tier each. A lap is 50m — out and back in a
25m pool — and the ghost touches the wall every length. At 60s and level 4 that
is 41 minutes and 2000m.

**TARGET / 50m** is the tier-1 lap time. **LEVEL** decides what the other two
tiers multiply it by:

| level | tier 1 | tier 2 | tier 3 | rep |
|-------|--------|--------|--------|-----|
| 1 | 1.00 | 1.00 | 1.00 | 10.0 × baseline |
| 2 | 1.00 | 1.00 | 0.95 | 9.8 |
| 3 | 1.00 | 0.95 | 0.95 | 9.6 |
| 4 | 1.00 | 0.95 | 0.90 | 9.4 |
| 5 | 0.95 | 0.95 | 0.90 | 9.3 |
| 6 | 0.95 | 0.90 | 0.90 | 9.1 |

Colour on the face is the **pace**, not the tier's position: slate blue at the
baseline, yellow at ×0.95, orange-red at ×0.90. So level 4 reads blue, yellow,
red — and level 6 reads yellow, red, red, because that is what it is asking for.
When two tiers share a pace they share a colour, and a mark is only drawn for a
gear that is genuinely quicker than the one being swum — a later tier at this
tier's pace would put its line on the 12, under the stub already waiting there,
promising a gear change that isn't one.

You are not sprinting every lap. You are holding one rhythm just quicker than the
ghost's, and earning a few seconds of rest at every wall. Going up a level
squeezes that rest out of one tier at a time; passing level 6 means dropping the
baseline 10% and starting the ladder again.

## Sound

Short tones, synthesised in the browser — no files, so they work with no signal
like everything else here.

| when | tone |
|------|------|
| 3, 2, 1 into the end of a lap | C, short |
| the lap's end | G, half a second |
| a lap that opens a new gear | C – E – G, three tenths each |

One beat per **lap**, not per length: the mid-lap turn is silent. The hand counts
a whole 50m and so does the number under it, so a countdown into the turn would
be a second rhythm running against the one on screen.

They're at octave 5 (523 / 659 / 784 Hz). The intervals are the ones asked for;
the octave is not, because C1 is 32.7 Hz and a phone speaker cannot move air at
it — let alone over a swimming pool. Change `OCTAVE` to shift all of it at once.

Every tone is handed to the audio clock up to a third of a second early, so the
beat lands where the hand does rather than where the frame loop happened to be.
Browsers won't make any sound before a tap, so the first one can't come before
START; media volume needs to be up, and on iOS the physical silent switch mutes
it (Android has no equivalent).

## Using it

Three buttons under the clock: **pause/play**, **skip**, **end**.

Skip does whichever thing there is to skip — a rest jumps to its closing five
seconds, a lap or a tier being swum jumps to the next segment.

**End finishes the swim rather than abandoning it**: it goes to the same screen
a completed cooldown reaches, says the swim was ended early, and still asks
whether to move up. A short swim can still have been held.

## Publishing it

It is a plain static site, so any host works. Two easy ones:

**Netlify Drop.** Open `app.netlify.com/drop` in a browser and drag the whole
`web` folder onto the page. It hands back an `https://…netlify.app` link in about
half a minute. Sign in (free) to keep the link and rename it.

**GitHub Pages.** Make a repo, upload the folder's contents, then Settings →
Pages → deploy from the default branch. Link is `yourname.github.io/reponame/`.

Either way your friend opens the link in Chrome, then uses **⋮ → Add to Home
Screen** (or the install prompt) to get an icon that opens fullscreen with no
browser chrome.

It must be served over **https**. That is what lets the app hold the screen awake
for the length of a swim; on plain `http` the request is refused and the phone
will sleep mid-rep.

## Testing it on your Mac

```sh
python3 -m http.server 8000 --directory web
```

Then `http://localhost:8000` on the Mac, or `http://<your-mac-ip>:8000` on a
phone on the same wifi. Over LAN http you get the visuals and the timing but not
the wake lock or the install prompt — both need https.

Two query parameters override the setup screen, which is how you watch a whole
session without swimming one:

```
?baseline=15&rest=10      80 lengths in about 10 minutes
```

And the schedule itself:

```sh
node Scripts/test_web_ghost.js
```

which checks the port against the watch's own numbers — the 2477-second session,
the 10.0 / 9.8 / 9.6 / 9.4 / 9.3 / 9.1 ladder, the 342° and 324° tier marks, and
that the arm is upright at every ghost touch.
