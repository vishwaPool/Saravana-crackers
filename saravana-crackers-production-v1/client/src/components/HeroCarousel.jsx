import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import day from "../assets/Banners/Banner image.png";
import night from "../assets/Banners/Banner image1.png";
const banners = [night, day];
export default function HeroCarousel() {
  const [slide, setSlide] = useState(0), [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setSlide(value => (value + 1) % banners.length), 5500);
    return () => clearInterval(timer);
  }, [paused]);
  const change = value => { setPaused(true); setSlide((value + banners.length) % banners.length); };
  return <section className="store-hero container" aria-label="Festival collection" aria-roledescription="carousel" onMouseEnter={() => setPaused(true)} onFocusCapture={() => setPaused(true)}>
    <h1 className="store-sr-only">Celebrate brighter with Saravana Crackers</h1>
    <Link to="/products" aria-label="Shop the Saravana Crackers collection"><img src={banners[slide]} alt={slide === 0 ? "Saravana Crackers — bright celebrations, brighter together" : "Saravana Crackers — celebrate brighter moments"} fetchPriority="high"/></Link>
    <button className="hero-arrow previous" aria-label="Previous banner" onClick={() => change(slide - 1)}>‹</button>
    <button className="hero-arrow next" aria-label="Next banner" onClick={() => change(slide + 1)}>›</button>
    <div className="hero-controls">{banners.map((_, index) => <button key={index} className={slide === index ? "selected" : ""} aria-label={`Show banner ${index + 1}`} aria-pressed={slide === index} onClick={() => change(index)}/>)}<button className="hero-pause" aria-label={paused ? "Play slideshow" : "Pause slideshow"} onClick={() => setPaused(value => !value)}>{paused ? "▶" : "Ⅱ"}</button></div>
  </section>;
}
