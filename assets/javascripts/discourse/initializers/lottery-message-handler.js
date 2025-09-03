import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-message-handler",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: 初始化消息处理器");

      // 修复：使用正确的方法名和绑定
      api.modifyClass("controller:topic", {
        pluginId: "discourse-lottery-v3",
        
        onMessage(data) {
          console.log("🎲 TopicController 收到消息:", data);
          
          if (data && typeof data === 'object' && data.type) {
            // 修复：使用箭头函数或直接调用来避免 this 绑定问题
            const handled = this._handleLotteryMessage(data);
            if (handled) {
              return; // 消息已处理，不传递给父类
            }
          }
          
          // 调用父类处理其他消息
          return this._super(data);
        },
        
        // 修复：使用单独的消息处理方法
        _handleLotteryMessage(data) {
          switch (data.type) {
            case 'lottery_created':
              return this._handleLotteryCreated(data);
            case 'lottery_completed':
              return this._handleLotteryCompleted(data);
            case 'lottery_updated':
              return this._handleLotteryUpdated(data);
            case 'lottery_cancelled':
              return this._handleLotteryCancelled(data);
            default:
              return false; // 未处理
          }
        },
        
        _handleLotteryCreated(data) {
          console.log("🎲 处理抽奖创建消息:", data);
          
          try {
            const currentTopic = this.get('model');
            if (currentTopic && currentTopic.get('id') == data.topic_id) {
              console.log("🎲 刷新当前主题以显示抽奖");
              
              // 延迟刷新，确保后端处理完成
              setTimeout(() => {
                this.refresh().catch(error => {
                  console.error("🎲 Topic refresh failed:", error);
                });
              }, 1000);
            }
          } catch (error) {
            console.error("🎲 Error handling lottery created:", error);
          }
          
          return true; // 消息已处理
        },
        
        _handleLotteryCompleted(data) {
          console.log("🎲 处理开奖完成消息:", data);
          
          try {
            const currentTopic = this.get('model');
            if (currentTopic && currentTopic.get('id') == data.topic_id) {
              console.log("🎲 刷新主题显示开奖结果");
              this.refresh();
            }
          } catch (error) {
            console.error("🎲 Error handling lottery completed:", error);
          }
          
          return true;
        },
        
        _handleLotteryUpdated(data) {
          console.log("🎲 处理抽奖更新消息:", data);
          
          try {
            const currentTopic = this.get('model');
            if (currentTopic && currentTopic.get('id') == data.topic_id) {
              console.log("🎲 刷新主题显示更新内容");
              this.refresh();
            }
          } catch (error) {
            console.error("🎲 Error handling lottery updated:", error);
          }
          
          return true;
        },
        
        _handleLotteryCancelled(data) {
          console.log("🎲 处理抽奖取消消息:", data);
          
          try {
            const currentTopic = this.get('model');
            if (currentTopic && currentTopic.get('id') == data.topic_id) {
              console.log("🎲 刷新主题显示取消状态");
              this.refresh();
            }
          } catch (error) {
            console.error("🎲 Error handling lottery cancelled:", error);
          }
          
          return true;
        }
      });

      console.log("🎲 Lottery: 消息处理器初始化完成");
    });
  },
};

// ====================================================================
// 3. 添加简单的调试函数到浏览器控制台
// ====================================================================

// 在浏览器控制台中可以使用的调试函数
window.lotteryDebug = {
  // 查找页面中的抽奖元素
  findLotteryElements: function() {
    const lotteryCards = document.querySelectorAll('.lottery-display-card');
    const lotteryTexts = document.querySelectorAll('p:contains("[lottery]"), div:contains("[lottery]")');
    
    console.log("🎲 抽奖卡片数量:", lotteryCards.length);
    console.log("🎲 包含[lottery]文本的元素:", lotteryTexts.length);
    
    return { cards: lotteryCards, texts: lotteryTexts };
  },
  
  // 手动触发内容处理
  processCurrentPage: function() {
    const cookedElements = document.querySelectorAll('.cooked');
    console.log("🎲 找到", cookedElements.length, "个 cooked 元素");
    
    cookedElements.forEach((element, index) => {
      console.log("🎲 处理元素", index);
      
      const textElements = element.querySelectorAll('p, div');
      textElements.forEach(textElement => {
        const text = textElement.textContent || '';
        if (text.includes('[lottery]') && text.includes('[/lottery]')) {
          console.log("🎲 找到抽奖内容:", text.substring(0, 100) + '...');
        }
      });
    });
  },
  
  // 检查是否有错误
  checkForErrors: function() {
    const errors = [];
    
    // 检查 DOM 结构
    if (!document.querySelector('.cooked')) {
      errors.push('没有找到 .cooked 元素');
    }
    
    // 检查抽奖内容
    const lotteryText = document.documentElement.textContent.includes('[lottery]');
    if (!lotteryText) {
      errors.push('页面中没有找到 [lottery] 标记');
    }
    
    console.log("🎲 错误检查结果:", errors.length === 0 ? '无错误' : errors);
    return errors;
  }
};

console.log("🎲 调试工具已加载，使用 window.lotteryDebug 访问");
