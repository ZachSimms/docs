/**
 * @file The topics on `/docs/` as a grid of cards: name, number and sheet count.
 *
 * Client component: the cards are the page's menu (see `useMenu`), so `j`/`k` and the
 * arrows move between them and coming back up from a topic highlights its card.
 */

"use client";

import Link from "next/link";
import { padNumber } from "@/lib/format";
import { useMenu } from "./useMenu";

/** One topic card. */
export interface TopicCard {
  readonly href: string;
  readonly name: string;
  /** The topic's number (counting down, as the lists do). */
  readonly number: number;
  /** Sheets in the topic, directories included. */
  readonly count: number;
}

/** Render `<nav data-menu>` with one `<a data-row>` card per topic. */
export function TopicCards({ cards }: { cards: readonly TopicCard[] }) {
  const { navRef, rowProps } = useMenu(cards.map((card) => card.href));

  return (
    <nav ref={navRef} data-menu="" className="topic-cards" aria-label="Topics">
      {cards.map((card, i) => (
        <Link key={card.href} href={card.href} className="card" {...rowProps(i)}>
          <span className="card-head">
            <i>{card.name}</i>
            <span className="dim">{padNumber(card.number)}</span>
          </span>
          <span className="dim">
            {card.count} {card.count === 1 ? "sheet" : "sheets"}
          </span>
        </Link>
      ))}
    </nav>
  );
}
