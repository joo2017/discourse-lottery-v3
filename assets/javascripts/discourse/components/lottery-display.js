// ========================================
// 2. 抽奖显示初始化器 - assets/javascripts/discourse/initializers/lottery-display.js
// ========================================

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-display",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 初始化抽奖显示组件");

      // 在帖子内容渲染后处理抽奖显示
      api.onPageChange((url, title) => {
        // 延迟执行，确保DOM已渲染
        setTimeout(() => {
          this.processLotteryDisplay();
        }, 100);
      });

      // 监听帖子流更新
      api.onAppEvent("post-stream:refresh", () => {
        setTimeout(() => {
          this.processLotteryDisplay();
        }, 100);
      });

      // 处理抽奖显示的核心方法
      this.processLotteryDisplay = function() {
        console.log("🎲 处理抽奖显示");
        
        // 查找所有包含 [lottery] 的帖子
        document.querySelectorAll('.topic-post').forEach((postElement) => {
          const postContent = postElement.querySelector('.post-content');
          if (!postContent) return;
          
          const rawContent = postContent.textContent || '';
          
          // 检查是否包含抽奖标记
          if (rawContent.includes('[lottery]') && rawContent.includes('[/lottery]')) {
            console.log("🎲 发现包含抽奖标记的帖子");
            
            // 检查是否已经处理过
            if (postElement.querySelector('.lottery-display-card')) {
              console.log("🎲 抽奖显示已存在，跳过");
              return;
            }
            
            // 提取抽奖数据
            const lotteryMatch = rawContent.match(/\[lottery\](.*?)\[\/lottery\]/s);
            if (lotteryMatch) {
              const lotteryData = this.parseLotteryContent(lotteryMatch[1]);
              console.log("🎲 解析到的抽奖数据:", lotteryData);
              
              if (lotteryData) {
                // 隐藏原始文本
                const lotteryTextElements = postContent.querySelectorAll('*');
                lotteryTextElements.forEach(el => {
                  if (el.textContent.includes('[lottery]')) {
                    el.style.display = 'none';
                  }
                });
                
                // 创建并插入抽奖显示组件
                const lotteryHTML = this.buildLotteryDisplayHTML(lotteryData);
                const lotteryElement = document.createElement('div');
                lotteryElement.innerHTML = lotteryHTML;
                
                postContent.appendChild(lotteryElement);
                console.log("🎲 已插入抽奖显示组件");
              }
            }
          }
        });
      };

      // 解析抽奖内容
      this.parseLotteryContent = function(content) {
        const data = {};
        const lines = content.split('\n');
        
        lines.forEach(line => {
          line = line.trim();
          if (line && line.includes('：')) {
            const [key, value] = line.split('：', 2);
            const trimmedKey = key.trim();
            const trimmedValue = value ? value.trim() : '';
            
            switch (trimmedKey) {
              case '活动名称':
                data.prize_name = trimmedValue;
                break;
              case '奖品说明':
                data.prize_details = trimmedValue;
                break;
              case '开奖时间':
                data.draw_time = trimmedValue;
                break;
              case '获奖人数':
                data.winners_count = parseInt(trimmedValue) || 1;
                break;
              case '指定楼层':
                if (trimmedValue) data.specified_posts = trimmedValue;
                break;
              case '参与门槛':
                const participants = trimmedValue.match(/\d+/);
                data.min_participants = participants ? parseInt(participants[0]) : 5;
                break;
              case '补充说明':
                if (trimmedValue) data.additional_notes = trimmedValue;
                break;
              case '奖品图片':
                if (trimmedValue) data.prize_image = trimmedValue;
                break;
            }
          }
        });
        
        // 设置默认状态
        data.status = 'running';
        data.lottery_type = data.specified_posts ? 'specified' : 'random';
        
        return data;
      };

      // 构建抽奖显示HTML
      this.buildLotteryDisplayHTML = function(lotteryData) {
        const statusClass = `lottery-status-${lotteryData.status || 'running'}`;
        const statusText = this.getStatusText(lotteryData.status);
        const formattedTime = this.formatTime(lotteryData.draw_time);
        
        let html = `<div class="lottery-display-card ${statusClass}">`;
        
        // 头部
        html += `<div class="lottery-header">`;
        html += `<div class="lottery-title">`;
        html += `<span class="lottery-icon">🎲</span>`;
        html += `<h3>${lotteryData.prize_name || '抽奖活动'}</h3>`;
        html += `</div>`;
        html += `<div class="lottery-status">${statusText}</div>`;
        html += `</div>`;
        
        // 内容区
        html += `<div class="lottery-content">`;
        
        // 奖品图片
        if (lotteryData.prize_image) {
          html += `<div class="lottery-image">`;
          html += `<img src="${lotteryData.prize_image}" alt="奖品图片" />`;
          html += `</div>`;
        }
        
        // 详细信息
        html += `<div class="lottery-details">`;
        html += `<div class="lottery-detail-item">`;
        html += `<span class="label">🎁 奖品说明：</span>`;
        html += `<span class="value">${lotteryData.prize_details || ''}</span>`;
        html += `</div>`;
        
        html += `<div class="lottery-detail-item">`;
        html += `<span class="label">⏰ 开奖时间：</span>`;
        html += `<span class="value">${formattedTime}</span>`;
        html += `</div>`;
        
        html += `<div class="lottery-detail-item">`;
        html += `<span class="label">🎯 抽奖方式：</span>`;
        html += `<span class="value">`;
        if (lotteryData.lottery_type === 'specified' || lotteryData.specified_posts) {
          html += `指定楼层 (${lotteryData.specified_posts || ''})`;
        } else {
          html += `随机抽取 ${lotteryData.winners_count || 1} 人`;
        }
        html += `</span>`;
        html += `</div>`;
        
        html += `<div class="lottery-detail-item">`;
        html += `<span class="label">👥 参与门槛：</span>`;
        html += `<span class="value">至少 ${lotteryData.min_participants || 5} 人参与</span>`;
        html += `</div>`;
        
        // 补充说明
        if (lotteryData.additional_notes) {
          html += `<div class="lottery-detail-item">`;
          html += `<span class="label">📝 补充说明：</span>`;
          html += `<span class="value">${lotteryData.additional_notes}</span>`;
          html += `</div>`;
        }
        
        html += `</div>`; // lottery-details
        html += `</div>`; // lottery-content
        
        // 底部
        html += `<div class="lottery-footer">`;
        html += `<div class="participation-tip">`;
        html += `💡 <strong>参与方式：</strong>在本话题下回复即可参与抽奖`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`; // lottery-display-card
        
        return html;
      };

      // 获取状态文本
      this.getStatusText = function(status) {
        const statusMap = {
          'running': '🏃 进行中',
          'finished': '🎉 已开奖',
          'cancelled': '❌ 已取消'
        };
        return statusMap[status] || '🏃 进行中';
      };

      // 格式化时间
      this.formatTime = function(timeString) {
        if (!timeString) return '';
        
        try {
          const date = new Date(timeString);
          return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (error) {
          console.error("🎲 时间格式化错误:", error);
          return timeString;
        }
      };

      // 立即处理当前页面
      setTimeout(() => {
        this.processLotteryDisplay();
      }, 500);

      console.log("🎲 抽奖显示组件初始化完成");
    });
  }
};
