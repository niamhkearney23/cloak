# Concept demos

Three small working examples built to show the range of what I make: a dashboard, a business automation and a customer-facing website. They are not client projects. Every name, company, matter and figure in them is made up.

| Demo | What it shows | Flow recorded for the video |
|---|---|---|
| [Legal dashboard](legal-dashboard/) — "Matterboard" | Matters, deadlines, tasks, activity, team | Open a matter → view its deadlines → assign a task |
| [Marketing automation](marketing-automation/) — "Flowline" | A workflow that runs when a website enquiry arrives | Submit the contact form → watch the follow-up workflow run step by step |
| [Booking website](booking-site/) — "Fern & Stone Studio" | A polished public site with online booking | Choose a treatment → pick a day and time → enter details → confirmation |

Each demo is a single `index.html` with no build step and no dependencies. Open the file in a browser, or serve all three:

```
node demos/serve.mjs        # http://localhost:8080
```

Each page carries a visible "Concept demo" badge so nobody mistakes it for a live client system.

## Recording the clips for the advert

`record.mjs` drives each demo through the flow above with a smooth, visible cursor and saves a 1600×900 clip per demo, plus a still for thumbnails.

```
npm install --no-save playwright && npx playwright install chromium   # once
node demos/record.mjs                                                 # all three
node demos/record.mjs booking                                         # just one
HEADED=1 node demos/record.mjs                                        # watch it happen
```

Output lands in `demos/recordings/` (ignored by git):

```
1-legal-dashboard.webm        ~20 s
2-marketing-automation.webm   ~23 s
3-booking-site.webm           ~27 s
```

If a full `ffmpeg` is on your PATH, an `.mp4` copy of each clip is written too. Most editors (CapCut, DaVinci Resolve, Premiere, Descript) take the `.mp4`; CapCut and DaVinci also take `.webm` directly.

Each clip runs longer than its slot in the 35-second advert on purpose. Trim to the interesting part and speed up the typing if you need to.

## Video brief

Give this to your editor or AI video tool together with the three clips. Fill in the two placeholders at the end.

> Create a 35-second portfolio advert for my custom software service. I build websites, dashboards, client portals and business automations.
>
> Use the supplied screen recordings of three working concept demos. Add a small, readable "Concept demo" label when each appears.
>
> **Visual direction:** polished, modern and confident. Large clean typography, close-up views of the interfaces, smooth cursor movements and restrained transitions. Let viewers understand each screen before cutting. Use subtle music beneath a natural female voiceover.
>
> **0–4 seconds:** Open with "Your business idea. Built." Show the strongest interface immediately.
>
> **4–12 seconds:** Show the legal dashboard: open a matter, view deadlines and assign a task. Caption: "Custom dashboards."
>
> **12–20 seconds:** Show the marketing tool: a new enquiry enters and triggers a follow-up workflow. Caption: "Business automations."
>
> **20–28 seconds:** Show the booking website: choose a service, select a time and reach the confirmation screen. Caption: "Websites that work."
>
> **28–35 seconds:** End with a clean montage and "What do you want to build?" followed by my name and Fiverr profile: **[YOUR NAME]** · **[FIVERR PROFILE URL]**.
>
> **Voiceover:** "A website for your business. A dashboard for your team. An automation that handles the repetitive work. I build custom digital tools around what you need. Have an idea? Let's make it work."
>
> Preserve the actual interface text and layout. Use real recordings for the product demonstrations; use AI for narration, captions and editing. Avoid invented testimonials, client names or results.

### Which clip goes where

| Advert time | Clip | Suggested trim |
|---|---|---|
| 0–4 s | `3-booking-site` | The hero, before the cursor moves. It is the most visual opener. |
| 4–12 s | `1-legal-dashboard` | From the click on the first matter to the "Task assigned" toast. |
| 12–20 s | `2-marketing-automation` | From clicking "Send enquiry" through the workflow lighting up. Speed up the typing before it. |
| 20–28 s | `3-booking-site` | From choosing the treatment to the confirmation tick. |
| 28–35 s | all three | Quick cuts of the stills, then the closing text. |

## Describing them honestly

These are examples I built to show what I can do, not completed client work. In a gig description or a message to a buyer, say exactly that: "concept demos I built to show the kind of dashboards, automations and websites I deliver". Do not attach invented clients, testimonials or results to them.
