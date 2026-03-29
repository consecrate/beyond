import Image from "next/image"

import { ExpandableBio } from "./expandable-bio"

export default function Page() {
  return (
    <main className="page">
      <div className="brand">
        <Image
          className="site-logo"
          src="/elle-logo.svg"
          alt=""
          width={56}
          height={56}
          decoding="async"
          unoptimized
        />
        <h1 className="site-title">Josh Trung</h1>
      </div>

      <div className="intro">
        <blockquote className="lede">
          The true soldier fights not because he hates what is in front of him, but because he loves what is
          behind him.
        </blockquote>
        <ExpandableBio />
        <ul className="project-links">
          <li>
            <a href="https://play.joshing.us" rel="noopener noreferrer">
              PlayDeck
            </a>
          </li>
          <li>
            <a href="https://firstly.joshing.us" rel="noopener noreferrer">
              Firstly
            </a>
          </li>
        </ul>
      </div>
    </main>
  )
}
