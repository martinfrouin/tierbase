import { genre, type Genre } from "@/lib/genre";

// Same names and order as GAME_GENRE_RULES in scripts/lib/game-genres.ts (the worker image can't import src/)
export const GAME_GENRES: Genre[] = [
  genre("Roguelite", "roguelites"),
  genre("Deckbuilder", "deckbuilders"),
  genre("Metroidvania", "metroidvanias"),
  genre("Soulslike", "soulslikes"),
  genre("RPG", "RPGs"),
  genre("JRPG", "JRPGs"),
  genre("Strategy", "strategy games"),
  genre("Shooter", "shooters"),
  genre("Platformer", "platformers"),
  genre("Puzzle", "puzzle games"),
  genre("Adventure", "adventure games"),
  genre("Fighting", "fighting games"),
  genre("Racing", "racing games"),
  genre("Sports", "sports games"),
  genre("Simulation", "simulation games"),
  genre("Visual novel", "visual novels"),
  genre("Survival", "survival games"),
  genre("Horror", "horror games"),
  genre("Open world", "open world games"),
  genre("Cozy", "cozy games"),
  genre("Indie", "indie games"),
];
