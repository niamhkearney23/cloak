// Shared by the tests: decide everything on the review screen the quick way.
export async function finishReview(session) {
  let d = session.reviewData();
  for (const u of d.unsure) d = await session.reviewAction({ type: 'fine', text: u.text });
  for (const m of d.merges) d = await session.reviewAction({ type: 'confirmMerge', tag: m.tag });
  for (const a of d.shortForms) d = await session.reviewAction({ type: 'confirmShortForm', tag: a.tag, also: a.also });
  for (const f of d.files.filter((x) => x.status === 'manual' && !x.checkedBy)) {
    if (f.nonLatinShowing) await session.reviewAction({ type: 'hideNonLatin', number: f.number });
    await session.approveFile(f.number);
  }
  return session.completeReview();
}
