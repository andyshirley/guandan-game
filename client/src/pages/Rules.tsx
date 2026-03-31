import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import "./Rules.css";

/**
 * 游戏规则说明页面
 */
export default function Rules() {
  const [, setLocation] = useLocation();

  return (
    <div className="rules-page">
      <div className="rules-container">
        <div className="rules-header">
          <h1>掼蛋规则</h1>
          <p>了解掼蛋游戏的完整规则和玩法</p>
        </div>

        <div className="rules-content">
          {/* 基本规则 */}
          <Card className="rule-section">
            <h2>基本规则</h2>
            <div className="rule-text">
              <p>
                掼蛋是一种四人对战的中国扑克游戏。游戏使用两副牌（108张），分为红桃、方块、梅花、黑桃四种花色，每种花色有13张牌（3-K、A、2）加上大小王。
              </p>
              <p>
                游戏目标是通过出牌，最先出完手中的所有牌。根据出完牌的顺序，玩家会获得不同的升级等级。
              </p>
            </div>
          </Card>

          {/* 牌型 */}
          <Card className="rule-section">
            <h2>牌型</h2>
            <div className="card-types">
              <div className="card-type-item">
                <h4>单牌</h4>
                <p>任意一张牌</p>
              </div>
              <div className="card-type-item">
                <h4>对子</h4>
                <p>两张点数相同的牌</p>
              </div>
              <div className="card-type-item">
                <h4>三张</h4>
                <p>三张点数相同的牌</p>
              </div>
              <div className="card-type-item">
                <h4>顺子</h4>
                <p>至少5张点数连续的单牌（不包括2和王）</p>
              </div>
              <div className="card-type-item">
                <h4>对顺</h4>
                <p>至少3对点数连续的对子（不包括2和王）</p>
              </div>
              <div className="card-type-item">
                <h4>三顺</h4>
                <p>至少2个点数连续的三张（不包括2和王）</p>
              </div>
              <div className="card-type-item">
                <h4>炸弹</h4>
                <p>四张或以上点数相同的牌</p>
              </div>
              <div className="card-type-item">
                <h4>王炸</h4>
                <p>大小王一起出</p>
              </div>
            </div>
          </Card>

          {/* 出牌规则 */}
          <Card className="rule-section">
            <h2>出牌规则</h2>
            <div className="rule-text">
              <ul>
                <li>第一个出牌的玩家可以出任意牌型</li>
                <li>后续玩家必须出比前一张牌更大的同牌型牌，或出炸弹/王炸</li>
                <li>如果无法出牌，可以选择"不要"，轮到下一个玩家</li>
                <li>如果连续3个玩家都"不要"，则出牌权回到最后出牌的玩家</li>
                <li>王炸可以压任何牌，炸弹可以压除了更大炸弹和王炸外的任何牌</li>
              </ul>
            </div>
          </Card>

          {/* 升级规则 */}
          <Card className="rule-section">
            <h2>升级规则</h2>
            <div className="rule-text">
              <p>
                游戏从3开始升级，依次为：3、4、5、6、7、8、9、10、J、Q、K、A、2。
              </p>
              <p>
                根据玩家出完牌的顺序，获得相应的升级等级：
              </p>
              <ul>
                <li>第一个出完牌的玩家：升级一级</li>
                <li>第二个出完牌的玩家：保持原级</li>
                <li>第三个出完牌的玩家：降级一级</li>
                <li>最后出完牌的玩家：降级一级</li>
              </ul>
            </div>
          </Card>

          {/* 进贡规则 */}
          <Card className="rule-section">
            <h2>进贡规则</h2>
            <div className="rule-text">
              <p>
                当玩家升级到最高等级（2）时，需要进行进贡。进贡规则如下：
              </p>
              <ul>
                <li>第一名玩家需要将手中最大的牌交给最后一名玩家</li>
                <li>第二名玩家需要将手中最大的牌交给第三名玩家</li>
                <li>第三名和最后一名玩家可以选择是否进行还贡</li>
              </ul>
            </div>
          </Card>

          {/* 游戏结束 */}
          <Card className="rule-section">
            <h2>游戏结束</h2>
            <div className="rule-text">
              <p>
                当所有玩家都出完手中的牌时，游戏结束。根据出完牌的顺序，玩家会获得相应的升级等级和积分。
              </p>
            </div>
          </Card>
        </div>

        <div className="rules-footer">
          <Button
            onClick={() => setLocation("/")}
            className="back-button"
            size="lg"
          >
            返回大厅
          </Button>
        </div>
      </div>
    </div>
  );
}
