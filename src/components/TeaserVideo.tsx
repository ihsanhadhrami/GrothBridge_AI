import { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  poster: string;
  label: string;
}

/**
 * Looping product clip with a voice-over. It autoplays muted (browsers block
 * autoplay with sound). Nothing downloads until the page has loaded and the
 * clip is on screen, which keeps the first paint light. Under
 * prefers-reduced-motion it never autoplays.
 * Two buttons: pause/play (WCAG 2.2.2), and sound on/off. Turning the sound
 * on restarts the clip, so the voice-over is heard from the first line in
 * sync with the picture.
 */
export function TeaserVideo({ src, poster, label }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const userPausedRef = useRef(userPaused);
  userPausedRef.current = userPaused;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let observer: IntersectionObserver | undefined;
    const start = () => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          if (entry.isIntersecting && !userPausedRef.current) {
            if (!video.src) video.src = src;
            video.play().catch(() => {
              /* autoplay refused: the poster stays and the button still works */
            });
          } else {
            video.pause();
          }
        },
        { threshold: 0.25 },
      );
      observer.observe(video);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      observer?.disconnect();
    };
  }, [src]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      if (!video.src) video.src = src;
      setUserPaused(false);
      video.play().catch(() => undefined);
    } else {
      setUserPaused(true);
      video.pause();
    }
  };

  const toggleSound = () => {
    const video = ref.current;
    if (!video) return;
    if (soundOn) {
      video.muted = true;
      setSoundOn(false);
      return;
    }
    if (!video.src) video.src = src;
    video.muted = false;
    video.currentTime = 0;
    setSoundOn(true);
    setUserPaused(false);
    video.play().catch(() => {
      // Playback with sound refused: fall back to muted so the button stays truthful.
      video.muted = true;
      setSoundOn(false);
    });
  };

  return (
    <figure className="teaser">
      <video
        ref={ref}
        className="teaser-video"
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        width={720}
        height={1280}
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button type="button" className="teaser-toggle teaser-sound" onClick={toggleSound} aria-pressed={soundOn}>
        {soundOn ? 'Voice Off' : 'Voice On'}
      </button>
      <button type="button" className="teaser-toggle" onClick={toggle} aria-pressed={!playing}>
        {playing ? 'Pause video' : 'Play video'}
      </button>
    </figure>
  );
}
