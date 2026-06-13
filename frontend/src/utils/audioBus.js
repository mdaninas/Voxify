let current = null;

export function playExclusive(audio, onPreempted) {
  if (current && current.audio !== audio) {
    current.audio.pause();
    const previous = current.onPreempted;
    current = null;
    if (previous) {
      previous();
    }
  }
  current = { audio, onPreempted };
  return audio.play();
}

export function releaseAudio(audio) {
  if (current && current.audio === audio) {
    current = null;
  }
}
