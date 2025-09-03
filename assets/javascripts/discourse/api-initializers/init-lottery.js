// ====================================================================
// 1. 修复 assets/javascripts/discourse/api-initializers/init-lottery.js
// ====================================================================

import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.14.0", (api) => {
  console.log("🎲 Lottery Plugin: Initializing with decorateCooked API");
  
  const siteSettings = api.container.lookup('service:site-settings');
  
  if (!siteSettings.lottery_enabled) {
    console.log("🎲 Lottery Plugin: Disabled via site settings");
    return;
  }
  
  let activeComponents = [];
  
  // 修复：使用更简单的方法处理抽奖内容
  api.decorateCooked((element, helper) => {
    // 修复：检查 element 是否为有效的 DOM 元素
    if (!element || !element.nodeType || element.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    
    try {
      processLotteryContent(element, helper);
    } catch (error) {
      console.error("🎲 Lottery decorateCooked error:", error);
    }
  }, {
    id: "lottery-content-processor"
  });
  
  function processLotteryContent(element, helper) {
    // 修复：使用 querySelectorAll 替代 TreeWalker
    const textElements = element.querySelectorAll('p, div');
    
    textElements.forEach(textElement => {
      const text = textElement.textContent || '';
      
      // 检查是否包含 [lottery] 标记
      if (text.includes('[lottery]') && text.includes('[/lottery]')) {
        const lotteryMatch = text.match(/\[lottery\](.*?)\[\/lottery\]/s);
        
        if (lotteryMatch) {
          console.log("🎲 Found lottery content:", lotteryMatch[1]);
          
          // 检查是否已经处理过（避免重复处理）
          if (textElement.querySelector('.lottery-display-card')) {
            console.log("🎲 Lottery already processed, skipping");
            return;
          }
          
          // 解析抽奖数据
          const lotteryData = parseLotteryContent(lotteryMatch[1]);
          
          if (lotteryData) {
            // 创建抽奖组件
            const lotteryWidget = createLotteryWidget(lotteryData, helper);
            
            // 隐藏原始文本并插入组件
            textElement.style.display = 'none';
            textElement.insertAdjacentElement('afterend', lotteryWidget);
            
            // 初始化交互功能
            setTimeout(() => {
              initializeLotteryWidget(lotteryWidget, lotteryData);
            }, 100);
          }
        }
      }
    });
  }
  
  function parseLotteryContent(content) {
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
    
    return Object.keys(data).length > 0 ? data : null;
  }
  
  function createLotteryWidget(lotteryData, helper) {
    const widget = document.createElement('div');
    widget.className = 'lottery-display-card lottery-status-running';
    
    const statusText = getStatusText(lotteryData.status);
    const formattedTime = formatTime(lotteryData.draw_time);
    
    widget.innerHTML = `
      <div class="lottery-header">
        <div class="lottery-title">
          <span class="lottery-icon">🎲</span>
          <h3>${escapeHtml(lotteryData.prize_name || '抽奖活动')}</h3>
        </div>
        <div class="lottery-status">${statusText}</div>
      </div>

      <div class="lottery-content">
        ${lotteryData.prize_image ? `
          <div class="lottery-image">
            <img src="${escapeHtml(lotteryData.prize_image)}" alt="奖品图片" />
          </div>
        ` : ''}

        <div class="lottery-details">
          <div class="lottery-detail-item">
            <span class="label">🎁 奖品说明：</span>
            <span class="value">${escapeHtml(lotteryData.prize_details || '')}</span>
          </div>

          <div class="lottery-detail-item">
            <span class="label">⏰ 开奖时间：</span>
            <span class="value">${formattedTime}</span>
          </div>

          <div class="lottery-detail-item">
            <span class="label">🎯 抽奖方式：</span>
            <span class="value">
              ${lotteryData.lottery_type === 'specified' || lotteryData.specified_posts
                ? `指定楼层 (${escapeHtml(lotteryData.specified_posts || '')})`
                : `随机抽取 ${lotteryData.winners_count || 1} 人`
              }
            </span>
          </div>

          <div class="lottery-detail-item">
            <span class="label">👥 参与门槛：</span>
            <span class="value">至少 ${lotteryData.min_participants || 5} 人参与</span>
          </div>

          ${lotteryData.additional_notes ? `
            <div class="lottery-detail-item">
              <span class="label">📝 补充说明：</span>
              <span class="value">${escapeHtml(lotteryData.additional_notes)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="lottery-footer">
        <div class="participation-tip">
          💡 <strong>参与方式：</strong>在本话题下回复即可参与抽奖
        </div>
      </div>
    `;
    
    return widget;
  }
  
  function initializeLotteryWidget(widget, lotteryData) {
    console.log("🎲 Initializing lottery widget for:", lotteryData.prize_name);
    
    // 标记为已处理
    widget.setAttribute('data-lottery-processed', 'true');
    
    // 添加点击事件
    widget.addEventListener('click', function(e) {
      console.log("🎲 Lottery widget clicked");
      // 这里可以添加更多交互逻辑
    });
    
    // 添加到活跃组件列表
    activeComponents.push({
      element: widget,
      data: lotteryData,
      destroy: function() {
        if (this.element.parentNode) {
          this.element.removeEventListener('click', this);
        }
      }
    });
  }
  
  function getStatusText(status) {
    const statusMap = {
      'running': '🏃 进行中',
      'finished': '🎉 已开奖',
      'cancelled': '❌ 已取消'
    };
    return statusMap[status] || '🏃 进行中';
  }
  
  function formatTime(timeString) {
    if (!timeString) return '';
    
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) {
        return timeString;
      }
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error("🎲 Time formatting error:", error);
      return timeString;
    }
  }
  
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // 页面导航清理
  api.onPageChange(() => {
    activeComponents.forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });
    activeComponents = [];
    console.log("🎲 Cleaned up lottery components on page change");
  });
  
  console.log("🎲 Lottery Plugin: Initialization completed");
});
