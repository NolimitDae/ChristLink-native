export interface Verse {
  reference: string;
  text: string;
  translation: string;
  themes: string[];
}

/** Offline fallback; mirrors the seed rows in the verses table (World English Bible, public domain). */
export const BUNDLED_VERSES: Verse[] = [
  { reference: 'Psalm 46:10', text: 'Be still, and know that I am God.', translation: 'WEB', themes: ['prayer', 'worship'] },
  { reference: 'Matthew 18:20', text: 'For where two or three are gathered together in my name, there I am in the middle of them.', translation: 'WEB', themes: ['fellowship', 'community', 'bible study'] },
  { reference: 'Philippians 4:6', text: 'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.', translation: 'WEB', themes: ['prayer'] },
  { reference: 'Psalm 95:1', text: 'Oh come, let’s sing to Yahweh. Let’s shout aloud to the rock of our salvation!', translation: 'WEB', themes: ['worship', 'concert'] },
  { reference: 'Hebrews 10:24', text: 'Let’s consider how to provoke one another to love and good works.', translation: 'WEB', themes: ['community', 'fellowship', 'outreach'] },
  { reference: 'Psalm 119:105', text: 'Your word is a lamp to my feet, and a light for my path.', translation: 'WEB', themes: ['bible study'] },
  { reference: 'Isaiah 40:31', text: 'But those who wait for Yahweh will renew their strength. They will mount up with wings like eagles.', translation: 'WEB', themes: ['retreat', 'prayer'] },
  { reference: '1 Timothy 4:12', text: 'Let no man despise your youth; but be an example to those who believe, in word, in your way of life, in love, in spirit, in faith, and in purity.', translation: 'WEB', themes: ['youth'] },
  { reference: 'Matthew 5:16', text: 'Even so, let your light shine before men, that they may see your good works, and glorify your Father who is in heaven.', translation: 'WEB', themes: ['outreach', 'community'] },
  { reference: 'Colossians 3:16', text: 'Let the word of Christ dwell in you richly; in all wisdom teaching and admonishing one another with psalms, hymns, and spiritual songs.', translation: 'WEB', themes: ['worship', 'bible study', 'concert'] },
  { reference: 'Psalm 133:1', text: 'See how good and how pleasant it is for brothers to live together in unity!', translation: 'WEB', themes: ['fellowship', 'community'] },
  { reference: 'Mark 6:31', text: 'Come away into a deserted place, and rest awhile.', translation: 'WEB', themes: ['retreat'] },
  { reference: 'Proverbs 27:17', text: 'Iron sharpens iron; so a man sharpens his friend’s countenance.', translation: 'WEB', themes: ['fellowship', 'youth', 'conference'] },
  { reference: 'Galatians 6:2', text: 'Bear one another’s burdens, and so fulfill the law of Christ.', translation: 'WEB', themes: ['prayer', 'community', 'outreach'] },
  { reference: 'Romans 12:12', text: 'Rejoicing in hope, enduring in troubles, continuing steadfastly in prayer.', translation: 'WEB', themes: ['prayer'] },
  { reference: 'Lamentations 3:22-23', text: 'His compassion doesn’t fail. They are new every morning. Great is your faithfulness.', translation: 'WEB', themes: [] },
  { reference: 'John 13:35', text: 'By this everyone will know that you are my disciples, if you have love for one another.', translation: 'WEB', themes: ['community', 'fellowship'] },
  { reference: 'Joshua 1:9', text: 'Be strong and courageous. Don’t be afraid. Don’t be dismayed, for Yahweh your God is with you wherever you go.', translation: 'WEB', themes: ['youth', 'conference'] },
  { reference: 'Psalm 100:2', text: 'Serve Yahweh with gladness. Come before his presence with singing.', translation: 'WEB', themes: ['worship', 'outreach'] },
  { reference: 'Acts 2:42', text: 'They continued steadfastly in the apostles’ teaching and fellowship, in the breaking of bread, and prayer.', translation: 'WEB', themes: ['bible study', 'fellowship'] },
  { reference: '2 Timothy 3:16', text: 'Every Scripture is God-breathed and profitable for teaching, for reproof, for correction, and for instruction in righteousness.', translation: 'WEB', themes: ['bible study', 'conference'] },
  { reference: '1 Peter 4:10', text: 'As each has received a gift, employ it in serving one another, as good managers of the grace of God.', translation: 'WEB', themes: ['outreach'] },
  { reference: 'Zephaniah 3:17', text: 'Yahweh your God is among you, a mighty one who will save. He will rejoice over you with joy.', translation: 'WEB', themes: ['worship'] },
  { reference: 'Psalm 23:1', text: 'Yahweh is my shepherd; I shall lack nothing.', translation: 'WEB', themes: ['retreat'] },
  { reference: 'Matthew 11:28', text: 'Come to me, all you who labor and are heavily burdened, and I will give you rest.', translation: 'WEB', themes: ['retreat', 'prayer'] },
  { reference: 'Ephesians 4:2-3', text: 'With all lowliness and humility, with patience, bearing with one another in love; being eager to keep the unity of the Spirit.', translation: 'WEB', themes: ['community'] },
  { reference: 'Jeremiah 29:11', text: 'For I know the thoughts that I think toward you, says Yahweh, thoughts of peace, and not of evil, to give you hope and a future.', translation: 'WEB', themes: ['youth'] },
  { reference: 'Psalm 150:6', text: 'Let everything that has breath praise Yah! Praise Yah!', translation: 'WEB', themes: ['worship', 'concert'] },
  { reference: 'James 5:16', text: 'Pray for one another, that you may be healed. The insistent prayer of a righteous person is powerfully effective.', translation: 'WEB', themes: ['prayer'] },
  { reference: 'Romans 15:13', text: 'Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope.', translation: 'WEB', themes: [] },
  { reference: 'Micah 6:8', text: 'What does Yahweh require of you, but to act justly, to love mercy, and to walk humbly with your God?', translation: 'WEB', themes: ['outreach', 'conference'] },
];

/** Same rotation as the SQL verse_of_the_day(): days since 2026-01-01, modulo the matching pool. */
export function bundledVerseOfTheDay(theme?: string | null, now = new Date()): Verse {
  const epoch = new Date(2026, 0, 1).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayIndex = Math.abs(Math.round((today - epoch) / 86_400_000));
  const themed = theme ? BUNDLED_VERSES.filter(v => v.themes.includes(theme.toLowerCase())) : [];
  const pool = themed.length > 0 ? themed : BUNDLED_VERSES;
  return pool[dayIndex % pool.length];
}
