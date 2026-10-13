import books from '../../test/fixtures/books.json';
import booknotes from '../../test/fixtures/booknotes.json';
import ideas from '../../test/fixtures/ideas.json';
import packs from '../../test/fixtures/packs.json';
import posts from '../../test/fixtures/posts.json';
import jobs from '../../test/fixtures/jobs.json';
import runs from '../../test/fixtures/runs.json';
import reports from '../../test/fixtures/reports.json';
import qa from '../../test/fixtures/qa.json';
import metrics from '../../test/fixtures/metrics.json';
import chats from '../../test/fixtures/chats.json';
import ratings from '../../test/fixtures/ratings.json';
import playbooks from '../../test/fixtures/playbooks.json';
import settings from '../../test/fixtures/settings.json';
import type { Fixtures } from './mockAdapter';

/** Invented demo data in the shape of the real collections. Used by mock and demo modes only. */
export const FIXTURES = { books, booknotes, ideas, packs, posts, jobs, runs, reports, qa, metrics, chats, ratings, playbooks, settings } as unknown as Fixtures;
