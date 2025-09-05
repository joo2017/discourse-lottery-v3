// assets/javascripts/discourse/api-initializers/init-lottery.js
// 修复语法错误，保持你现有的文件结构

import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.14.0", (api) => {
  console.log("Lottery Plugin: Initializing with decorateCooked API");
  
  const siteSettings = api.container.lookup('service:site-settings');
  
  if (!siteSettings.lottery_enabled) {
    console.log("Lottery Plugin: Disabled via site settings");
    return;
  }
  
  let processedElements = new WeakSet();
  
  api.decorateCooked((element, helper) => {
    if (!element || processedElements.has(element)) {
      return;
    }
    
    try {
      processLotteryContent(element, helper);
      processedElements.add(element);
    } catch (error) {
      console.error("Lottery decorateCooked error:", error);
    }
  }, {
    id: "lottery-content-processor"
  });
  
  function processLotteryContent(element, helper) {
    if (!element.nodeType || element.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    
    const textElements = element.querySelectorAll('p, div');
    
    textElements.forEach(function(textElement) {
      const text = textElement.textContent || '';
      
      if (text.includes('[lottery]') && text.includes('[/lottery]')) {
        const lotteryMatch = text.match(/\[lottery\](.*?)\[\/lottery\]/s);
        
        if (lotteryMatch) {
          console.log("Found lottery content:", lotteryMatch[1]);
          
          if (textElement.querySelector('.lottery-display-card')) {
            console.log("Lottery already processed, skipping");
            return;
          }
          
          const lotteryData = parseLotteryContent(lotteryMatch[1]);
          
          if (lotteryData) {
            const lotteryWidget = createLotteryWidget(lotteryData, helper);
            
            textElement.style.display = 'none';
            textElement.insertAdjacentElement('afterend', lotteryWidget);
            
            setTimeout(function() {
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
    
    lines.forEach(function(line) {
      line = line.trim();
      if (line && line.includes('：')) {
        const parts = line.split('：', 2);
        const trimmedKey = parts[0].trim();
        const trimmedValue = parts[1] ? parts[1].trim() : '';
        
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
    
    data.status = 'running';
    data.lottery_type = data.specified_posts ? 'specified' : 'random';
    
    return Object.keys(data).length > 0 ? data : null;
  }
  
  function createLotteryWidget(lotteryData, helper) {
    const widget = document.createElement('div');
    widget.className = 'lottery-display-card lottery-status-running';
    
    const statusText = getStatusText(lotteryData.status);
    const formattedTime = formatTime(lotteryData.draw_time);
    
    widget.innerHTML = buildWidgetHTML(lotteryData, statusText, formattedTime);
    
    return widget;
  }
  
  function buildWidgetHTML(lotteryData, statusText, formattedTime) {
    let html = '<div class="lottery-header">';
    html += '<div class="lottery-title">';
    html += '<span class="lottery-icon">🎲</span>';
    html += '<h3>' + escapeHtml(lotteryData.prize_name || '抽奖活动') + '</h3>';
    html += '</div>';
    html += '<div class="lottery-status">' + statusText + '</div>';
    html += '</div>';

    html += '<div class="lottery-content">';
    
    if (lotteryData.prize_image) {
      html += '<div class="lottery-image">';
      html += '<img src="' + escapeHtml(lotteryData.prize_image) + '" alt="奖品图片" />';
      html += '</div>';
    }

    html += '<div class="lottery-details">';
    html += '<div class="lottery-detail-item">';
    html += '<span class="label">🎁 奖品说明：</span>';
    html += '<span class="value">' + escapeHtml(lotteryData.prize_details || '') + '</span>';
    html += '</div>';

    html += '<div class="lottery-detail-item">';
    html += '<span class="label">⏰ 开奖时间：</span>';
    html += '<span class="value">' + formattedTime + '</span>';
    html += '</div>';

    html += '<div class="lottery-detail-item">';
    html += '<span class="label">🎯 抽奖方式：</span>';
    html += '<span class="value">';
    if (lotteryData.lottery_type === 'specified' || lotteryData.specified_posts) {
      html += '指定楼层 (' + escapeHtml(lotteryData.specified_posts || '') + ')';
    } else {
      html += '随机抽取 ' + (lotteryData.winners_count || 1) + ' 人';
    }
    html += '</span>';
    html += '</div>';

    html += '<div class="lottery-detail-item">';
    html += '<span class="label">👥 参与门槛：</span>';
    html += '<span class="value">至少 ' + (lotteryData.min_participants || 5) + ' 人参与</span>';
    html += '</div>';

    if (lotteryData.additional_notes) {
      html += '<div class="lottery-detail-item">';
      html += '<span class="label">📝 补充说明：</span>';
      html += '<span class="value">' + escapeHtml(lotteryData.additional_notes) + '</span>';
      html += '</div>';
    }
    
    html += '</div>';
    html += '</div>';

    html += '<div class="lottery-footer">';
    html += '<div class="participation-tip">';
    html += '💡 <strong>参与方式：</strong>在本话题下回复即可参与抽奖';
    html += '</div>';
    html += '</div>';
    
    return html;
  }
  
  function initializeLotteryWidget(widget, lotteryData) {
    console.log("Initializing lottery widget for:", lotteryData.prize_name);
    
    widget.setAttribute('data-lottery-processed', 'true');
    
    widget.addEventListener('click', function(e) {
      console.log("Lottery widget clicked");
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
      console.error("Time formatting error:", error);
      return timeString;
    }
  }
  
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  api.onPageChange(function() {
    processedElements = new WeakSet();
    console.log("Cleaned up lottery components on page change");
  });
  
  console.log("Lottery Plugin: Initialization completed");
});
