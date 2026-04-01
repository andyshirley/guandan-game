/**
 * 红心参谋（逢人配）牌型识别测试
 */

import { describe, it, expect } from "vitest";
import { Rank, Suit, CardType, Card } from "../shared/types";
import { identifyCardType, isHeartRank } from "../client/src/lib/gameEngine";

describe("红心参谋（逢人配）", () => {
  describe("基础功能", () => {
    it("应该正确识别红心参谋", () => {
      const card: Card = { id: "h2-1", rank: Rank.Two, suit: Suit.Hearts };
      expect(isHeartRank(card, Rank.Two)).toBe(true);
    });

    it("非红心的当前级别牌不是红心参谋", () => {
      const card: Card = { id: "d2-1", rank: Rank.Two, suit: Suit.Diamonds };
      expect(isHeartRank(card, Rank.Two)).toBe(false);
    });
  });

  describe("炸弹识别", () => {
    it("红桃2配3个7应该识别为7炸（打2时）", () => {
      const cards: Card[] = [
        { id: "h2-1", rank: Rank.Two, suit: Suit.Hearts },
        { id: "d7-1", rank: Rank.Seven, suit: Suit.Diamonds },
        { id: "s7-1", rank: Rank.Seven, suit: Suit.Spades },
        { id: "h7-1", rank: Rank.Seven, suit: Suit.Hearts },
      ];
      const cardType = identifyCardType(cards, Rank.Two);
      expect(cardType).toBe(CardType.Bomb);
    });

    it("红桃3配3个7应该识别为7炸（打3时）", () => {
      const cards: Card[] = [
        { id: "h3-1", rank: Rank.Three, suit: Suit.Hearts },
        { id: "d7-1", rank: Rank.Seven, suit: Suit.Diamonds },
        { id: "s7-1", rank: Rank.Seven, suit: Suit.Spades },
        { id: "c7-1", rank: Rank.Seven, suit: Suit.Clubs },
      ];
      const cardType = identifyCardType(cards, Rank.Three);
      expect(cardType).toBe(CardType.Bomb);
    });

    it("2张红心参谋配2个K应该识别为K炸（打3时）", () => {
      const cards: Card[] = [
        { id: "h3-1", rank: Rank.Three, suit: Suit.Hearts },
        { id: "h3-2", rank: Rank.Three, suit: Suit.Hearts },
        { id: "dK-1", rank: Rank.King, suit: Suit.Diamonds },
        { id: "sK-1", rank: Rank.King, suit: Suit.Spades },
      ];
      const cardType = identifyCardType(cards, Rank.Three);
      expect(cardType).toBe(CardType.Bomb);
    });

    it("1张红心参谋配4个10应该识别为5张10炸（打7时）", () => {
      const cards: Card[] = [
        { id: "h7-1", rank: Rank.Seven, suit: Suit.Hearts },
        { id: "d10-1", rank: Rank.Ten, suit: Suit.Diamonds },
        { id: "s10-1", rank: Rank.Ten, suit: Suit.Spades },
        { id: "h10-1", rank: Rank.Ten, suit: Suit.Hearts },
        { id: "c10-1", rank: Rank.Ten, suit: Suit.Clubs },
      ];
      const cardType = identifyCardType(cards, Rank.Seven);
      expect(cardType).toBe(CardType.Bomb);
    });

    it("只有3张7（没有红心参谋）不应该识别为炸弹", () => {
      const cards: Card[] = [
        { id: "d7-1", rank: Rank.Seven, suit: Suit.Diamonds },
        { id: "s7-1", rank: Rank.Seven, suit: Suit.Spades },
        { id: "h7-1", rank: Rank.Seven, suit: Suit.Hearts },
      ];
      const cardType = identifyCardType(cards, Rank.Two);
      expect(cardType).toBe(CardType.Triple); // 三张
    });

    it("红心2配2个7不应该识别为炸弹（只有3张）", () => {
      const cards: Card[] = [
        { id: "h2-1", rank: Rank.Two, suit: Suit.Hearts },
        { id: "d7-1", rank: Rank.Seven, suit: Suit.Diamonds },
        { id: "s7-1", rank: Rank.Seven, suit: Suit.Spades },
      ];
      const cardType = identifyCardType(cards, Rank.Two);
      expect(cardType).toBe(CardType.Triple); // 三张
    });

    it("红心2配不同点数的牌不应该识别为炸弹", () => {
      const cards: Card[] = [
        { id: "h2-1", rank: Rank.Two, suit: Suit.Hearts },
        { id: "d7-1", rank: Rank.Seven, suit: Suit.Diamonds },
        { id: "s8-1", rank: Rank.Eight, suit: Suit.Spades },
        { id: "h9-1", rank: Rank.Nine, suit: Suit.Hearts },
      ];
      const cardType = identifyCardType(cards, Rank.Two);
      expect(cardType).toBe(null); // 无效牌型
    });
  });

  describe("其他牌型识别", () => {
    it("红心参谋配对子", () => {
      const cards: Card[] = [
        { id: "h2-1", rank: Rank.Two, suit: Suit.Hearts },
        { id: "d7-1", rank: Rank.Seven, suit: Suit.Diamonds },
      ];
      const cardType = identifyCardType(cards, Rank.Two);
      expect(cardType).toBe(CardType.Pair);
    });

    it("红心参谋配三张", () => {
      const cards: Card[] = [
        { id: "h2-1", rank: Rank.Two, suit: Suit.Hearts },
        { id: "d7-1", rank: Rank.Seven, suit: Suit.Diamonds },
        { id: "s7-1", rank: Rank.Seven, suit: Suit.Spades },
      ];
      const cardType = identifyCardType(cards, Rank.Two);
      expect(cardType).toBe(CardType.Triple);
    });
  });
});
