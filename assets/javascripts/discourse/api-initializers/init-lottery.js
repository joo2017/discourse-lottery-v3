// assets/javascripts/discourse/api-initializers/init-lottery.js
// 基于discourse-calendar的decorateCooked模式

import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.14.0", (api) => {
  console.log("🎲 Lottery: Initializing display component");
  
  const siteSettings = api.container.lookup('service:site-settings');
  
  if (!siteSettings.lottery_enabled) {
    console.log("🎲 Lottery disabled");
    return;
  }
  
  let processedElements = new WeakSet();
  
  // 修复1: 使用discourse-calendar的decorateCooked模式
  api.decorateCooked((element, helper) => {
    if (!element || processedElements.has(element)) {
      return;
    }
    
    try {
      processLotteryContent(element, helper);
      processedElements.add(element);
    } catch (error) {
      console.error("🎲 Lottery decorateCooked error:", error);
    }
  }, {
    id: "lottery-content-processor"
  });
  
  function processLotteryContent(element, helper) {
    // 查找包含[lottery]标记的文本
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const text = node.textContent || '';
          return text.includes('[lottery]') && text.includes('[/lottery]') ? 
            NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    textNodes.forEach(textNode => {
      processLotteryTextNode(textNode, helper);
    });
  }
  
  function processLotteryTextNode(textNode, helper) {
    const text = textNode.textContent;
    const lotteryMatch = text.match(/\[lottery\](.*?)\[\/lottery\]/s);
    
    if (!lotteryMatch) return;
    
    const parentElement = textNode.parentElement;
    if (!parentElement) return;
    
    // 检查是否已处理
    if (parentElement.querySelector('.lottery-display-card')) {
      return;
    }
    
    console.log("🎲 Processing lottery content");
    
    // 解析抽奖数据
    const lotteryData = parseLotteryContent(lotteryMatch[1]);
    if (!lotteryData) return;
    
    // 隐藏原始文本
    parentElement.style.display = 'none';
    
    // 创建并插入抽奖显示组件
    const lotteryWidget = createLotteryWidget(lotteryData);
    parentElement.parentNode.insertBefore(lotteryWidget, parentElement.nextSibling);
    
    console.log("🎲 Lottery widget created");
  }
  
  function parseLotteryContent(content) {
    const data = {
      status: 'running' // 默认状态
    };
    
    const lines = content.split('\n');
    
    lines.forEach(line => {
      line = line.trim();
      if (!line || !line.includes('：')) return;
      
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
        case '指定中奖楼层':
          if (trimmedValue) {
            data.specified_posts = trimmedValue;
            data.lottery_type = 'specified';
          }
          break;
        case '参与门槛':
          const match = trimmedValue.match(/\d+/);
          data.min_participants = match ? parseInt(match[0]) : 5;
          break;
        case '补充说明':
          if (trimmedValue) data.additional_notes = trimmedValue;
          break;
        case '奖品图片':
          if (trimmedValue) data.prize_image = trimmedValue;
          break;
      }
    });
    
    // 设置抽奖类型
    if (!data.lottery_type) {
      data.lottery_type = data.specified_posts ? 'specified' : 'random';
    }
    
    return data.prize_name && data.prize_details && data.draw_time ? data : null;
  }
  
  function createLotteryWidget(data) {
    const widget = document.createElement('div');
    widget.className = `lottery-display-card lottery-status-${data.status}`;
    widget.setAttribute('data-lottery-processed', 'true');
    
    const statusText = getStatusText(data.status);
    const formattedTime = formatTime(data.draw_time);
    
    widget.innerHTML = `
      <div class="lottery-header">
        <div class="lottery-title">
          <span class="lottery-icon">🎲</span>
          <h3>${escapeHtml(data.prize_name)}</h3>
        </div>
        <div class="lottery-status">${statusText}</div>
      </div>

      <div class="lottery-content">
        ${data.prize_image ? `
          <div class="lottery-image">
            <img src="${escapeHtml(data.prize_image)}" alt="奖品图片" loading="lazy" />
          </div>
        ` : ''}

        <div class="lottery-details">
          <div class="lottery-detail-item">
            <span class="label">🎁 奖品说明：</span>
            <span class="value">${escapeHtml(data.prize_details)}</span>
          </div>

          <div class="lottery-detail-item">
            <span class="label">⏰ 开奖时间：</span>
            <span class="value">${formattedTime}</span>
          </div>

          <div class="lottery-detail-item">
            <span class="label">🎯 抽奖方式：</span>
            <span class="value">
              ${data.lottery_type === 'specified' && data.specified_posts
                ? `指定楼层 (${escapeHtml(data.specified_posts)})`
                : `随机抽取 ${data.winners_count || 1} 人`
              }
            </span>
          </div>

          <div class="lottery-detail-item">
            <span class="label">👥 参与门槛：</span>
            <span class="value">至少 ${data.min_participants || 5} 人参与</span>
          </div>

          ${data.additional_notes ? `
            <div class="lottery-detail-item">
              <span class="label">📝 补充说明：</span>
              <span class="value">${escapeHtml(data.additional_notes)}</span>
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
    
    // 添加交互功能
    addWidgetInteractions(widget, data);
    
    return widget;
  }
  
  function addWidgetInteractions(widget, data) {
    // 图片点击放大
    const image = widget.querySelector('.lottery-image img');
    if (image) {
      image.addEventListener('click', function() {
        showImageModal(image.src);
      });
    }
    
    // 添加倒计时
    if (data.status === 'running' && data.draw_time) {
      startCountdown(widget, data.draw_time);
    }
  }
  
  function showImageModal(imageSrc) {
    const modal = document.createElement('div');
    modal.className = 'lottery-image-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <img src="${imageSrc}" alt="奖品图片" />
          <button class="close-btn" onclick="this.closest('.lottery-image-modal').remove()">×</button>
        </div>
      </div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .lottery-image-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
      }
      .lottery-image-modal .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .lottery-image-modal .modal-content {
        position: relative;
        max-width: 90vw;
        max-height: 90vh;
        cursor: default;
      }
      .lottery-image-modal img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }
      .lottery-image-modal .close-btn {
        position: absolute;
        top: -10px;
        right: -10px;
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(modal);
  }
  
  function startCountdown(widget, drawTime) {
    try {
      const endTime = new Date(drawTime).getTime();
      
      const updateCountdown = () => {
        const now = new Date().getTime();
        const distance = endTime - now;
        
        if (distance < 0) {
          const footer = widget.querySelector('.lottery-footer .participation-tip');
          if (footer) {
            footer.innerHTML = '⏰ 开奖时间已到，请等待系统处理...';
          }
          return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        
        let countdownText;
        if (days > 0) {
          countdownText = `⏱️ 距离开奖：${days}天 ${hours}小时`;
        } else if (hours > 0) {
          countdownText = `⏱️ 距离开奖：${hours}小时 ${minutes}分钟`;
        } else {
          countdownText = `⏱️ 距离开奖：${minutes}分钟`;
        }
        
        const footer = widget.querySelector('.lottery-footer .participation-tip');
        if (footer) {
          footer.innerHTML = `${countdownText}<br>💡 <strong>参与方式：</strong>在本话题下回复即可参与抽奖`;
        }
        
        setTimeout(updateCountdown, 60000); // 每分钟更新
      };
      
      updateCountdown();
    } catch (error) {
      console.error("🎲 Countdown error:", error);
    }
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
        minute: '2-digit',
        hour12: false
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
  
  // 页面切换清理
  api.onPageChange(() => {
    // 清理模态框
    document.querySelectorAll('.lottery-image-modal').forEach(modal => {
      modal.remove();
    });
    
    // 重置处理标记
    processedElements = new WeakSet();
  });
  
  console.log("🎲 Lottery: Display component initialization completed");
});
