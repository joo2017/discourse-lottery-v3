// assets/javascripts/discourse/initializers/lottery-display-initializer.js
// 纯前端的抽奖显示方案 - 实时预览，无需保存

import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-display-initializer",
  
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 抽奖显示初始化器启动 - 纯前端方案");

      // === 实时预览功能 ===
      
      // 监听编辑器内容变化，实时显示抽奖卡片
      api.decorateCooked((element, helper) => {
        if (!element) return;
        
        // 查找抽奖占位符
        const lotteryElements = element.querySelectorAll('p');
        
        lotteryElements.forEach(p => {
          const text = p.textContent;
          if (text.includes('[lottery]') && text.includes('[/lottery]')) {
            console.log("🎲 发现抽奖占位符，开始处理");
            
            try {
              // 解析占位符数据
              const lotteryData = this.parseLotteryPlaceholder(text);
              console.log("🎲 解析的数据:", lotteryData);
              
              // 生成美化HTML
              const beautifulHtml = this.generateLotteryCard(lotteryData);
              
              // 替换内容
              p.innerHTML = beautifulHtml;
              p.classList.add('lottery-processed');
              
              console.log("🎲 成功替换为美化卡片");
              
            } catch (error) {
              console.error("🎲 处理抽奖显示出错:", error);
            }
          }
        });
      });

      // === 主题页面的抽奖数据显示 ===
      
      api.onPageChange(() => {
        setTimeout(() => {
          this.enhanceTopicLotteryDisplay();
        }, 100);
      });

      console.log("🎲 抽奖显示初始化器完成");
    });
  },

  // 解析抽奖占位符数据
  parseLotteryPlaceholder(text) {
    const data = {
      prize_name: '抽奖活动',
      prize_details: '精美奖品等你来拿',
      draw_time: '待定',
      winners_count: 1,
      min_participants: 1,
      backup_strategy: 'continue',
      additional_notes: '',
      prize_image: '',
      status: 'running'
    };

    // 提取[lottery]...[/lottery]之间的内容
    const match = text.match(/\[lottery\](.*?)\[\/lottery\]/ms);
    if (!match) return data;

    const content = match[1];
    const lines = content.split('\n');

    lines.forEach(line => {
      line = line.trim();
      if (line.includes('：')) {
        const [key, value] = line.split('：', 2);
        const cleanKey = key.trim();
        const cleanValue = value.trim();

        switch (cleanKey) {
          case '活动名称':
            data.prize_name = cleanValue;
            break;
          case '奖品说明':
            data.prize_details = cleanValue;
            break;
          case '开奖时间':
            data.draw_time = cleanValue;
            break;
          case '获奖人数':
            data.winners_count = parseInt(cleanValue) || 1;
            break;
          case '指定楼层':
            data.specified_posts = cleanValue;
            break;
          case '参与门槛':
            data.min_participants = parseInt(cleanValue.replace(/\D/g, '')) || 1;
            break;
          case '补充说明':
            data.additional_notes = cleanValue;
            break;
          case '奖品图片':
            data.prize_image = cleanValue;
            break;
          case '后备策略':
            data.backup_strategy = cleanValue.includes('继续') ? 'continue' : 'cancel';
            break;
        }
      }
    });

    return data;
  },

  // 生成美化的抽奖卡片HTML
  generateLotteryCard(data) {
    const statusText = this.getStatusText(data.status);
    const statusClass = `lottery-status-${data.status}`;
    
    // 格式化时间
    const formattedTime = this.formatDrawTime(data.draw_time);
    
    // 抽奖方式
    const lotteryMethod = data.specified_posts ? 
      `指定楼层 (${data.specified_posts})` : 
      `随机抽取 ${data.winners_count} 人`;

    let html = `
      <div class="lottery-display-card ${statusClass}">
        <div class="lottery-header">
          <div class="lottery-title">
            <span class="lottery-icon">🎲</span>
            <h3>${this.escapeHtml(data.prize_name)}</h3>
          </div>
          <div class="lottery-status">${statusText}</div>
        </div>
        <div class="lottery-content">
    `;

    // 添加图片
    if (data.prize_image) {
      const imageUrl = data.prize_image.startsWith('//') ? 
        `https:${data.prize_image}` : data.prize_image;
      
      html += `
          <div class="lottery-image">
            <img src="${this.escapeHtml(imageUrl)}" alt="奖品图片" loading="lazy" />
          </div>
      `;
    }

    // 添加详情
    html += `
          <div class="lottery-details">
            <div class="lottery-detail-item">
              <span class="label">🎁 奖品说明：</span>
              <span class="value">${this.escapeHtml(data.prize_details)}</span>
            </div>
            <div class="lottery-detail-item">
              <span class="label">⏰ 开奖时间：</span>
              <span class="value">${this.escapeHtml(formattedTime)}</span>
            </div>
            <div class="lottery-detail-item">
              <span class="label">🎯 抽奖方式：</span>
              <span class="value">${this.escapeHtml(lotteryMethod)}</span>
            </div>
            <div class="lottery-detail-item">
              <span class="label">👥 参与门槛：</span>
              <span class="value">至少 ${data.min_participants} 人参与</span>
            </div>
    `;

    // 添加补充说明
    if (data.additional_notes) {
      html += `
            <div class="lottery-detail-item">
              <span class="label">📝 补充说明：</span>
              <span class="value">${this.escapeHtml(data.additional_notes)}</span>
            </div>
      `;
    }

    html += `
          </div>
        </div>
        <div class="lottery-footer">
          <div class="participation-tip">
            💡 <strong>参与方式：</strong>在本话题下回复即可参与抽奖
          </div>
        </div>
      </div>
    `;

    return html;
  },

  // 增强主题页面的抽奖显示（使用数据库数据）
  enhanceTopicLotteryDisplay() {
    try {
      const topicController = Discourse.__container__.lookup('controller:topic');
      if (!topicController) return;

      const model = topicController.get('model');
      if (!model || !model.lottery_data) return;

      console.log("🎲 发现主题页面有抽奖数据，增强显示");

      // 查找已处理的抽奖元素，用数据库数据更新
      const processedElements = document.querySelectorAll('.lottery-processed');
      
      processedElements.forEach(element => {
        try {
          // 使用数据库中的完整数据重新渲染
          const completeData = Object.assign({}, model.lottery_data, {
            status: model.lottery_status || 'running'
          });
          
          const enhancedHtml = this.generateLotteryCard(completeData);
          element.innerHTML = enhancedHtml;
          
          console.log("🎲 已用数据库数据增强显示");
          
        } catch (error) {
          console.error("🎲 增强显示出错:", error);
        }
      });

    } catch (error) {
      console.error("🎲 enhanceTopicLotteryDisplay 出错:", error);
    }
  },

  // 辅助方法
  getStatusText(status) {
    const statusMap = {
      'running': '🏃 进行中',
      'finished': '🎉 已开奖', 
      'cancelled': '❌ 已取消'
    };
    return statusMap[status] || '🏃 进行中';
  },

  formatDrawTime(drawTime) {
    try {
      const date = new Date(drawTime);
      if (isNaN(date.getTime())) return drawTime;
      
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return drawTime;
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
