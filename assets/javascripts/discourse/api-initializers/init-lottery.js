// assets/javascripts/discourse/api-initializers/init-lottery.js
// 基于discourse-calendar最佳实践的修复版本

import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.14.0", (api) => {
  console.log("🎲 Lottery: Initializing with official API patterns");
  
  const siteSettings = api.container.lookup('service:site-settings');
  
  if (!siteSettings.lottery_enabled) {
    console.log("🎲 Lottery: Disabled via settings");
    return;
  }
  
  let processedElements = new WeakSet();
  
  // 修复1: 使用正确的decorateCooked API
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
    id: "lottery-content-processor",
    onlyStream: true // 修复：只在流式加载时处理
  });
  
  // 修复2: 监听MessageBus消息更新
  api.onPageChange(() => {
    subscribeLotteryUpdates();
  });
  
  function subscribeLotteryUpdates() {
    const topicId = getCurrentTopicId();
    if (!topicId) return;
    
    api.container.lookup('service:message-bus').subscribe(`/topic/${topicId}`, (data) => {
      if (data.type && data.type.startsWith('lottery_')) {
        console.log("🎲 Received lottery update:", data.type);
        
        // 延迟刷新以确保后端处理完成
        setTimeout(() => {
          refreshLotteryDisplay();
        }, 1000);
      }
    });
  }
  
  function getCurrentTopicId() {
    const controller = api.container.lookup('controller:topic');
    return controller?.get('model.id');
  }
  
  function refreshLotteryDisplay() {
    // 清除已处理标记，允许重新处理
    processedElements = new WeakSet();
    
    // 重新处理所有cooked内容
    document.querySelectorAll('.cooked').forEach(element => {
      processLotteryContent(element, null);
    });
  }

  function processLotteryContent(element, helper) {
    // 修复3: 更安全的内容查找
    if (!element.nodeType || element.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    
    // 查找包含lottery标记的文本节点
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          return node.textContent.includes('[lottery]') ? 
            NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    const textNodesToProcess = [];
    let node;
    
    while (node = walker.nextNode()) {
      textNodesToProcess.push(node);
    }
    
    textNodesToProcess.forEach(textNode => {
      processTextNode(textNode, helper);
    });
  }
  
  function processTextNode(textNode, helper) {
    const text = textNode.textContent;
    const lotteryMatch = text.match(/\[lottery\](.*?)\[\/lottery\]/s);
    
    if (!lotteryMatch) return;
    
    const parentElement = textNode.parentElement;
    if (!parentElement) return;
    
    // 检查是否已处理
    if (parentElement.querySelector('.lottery-display-card')) {
      return;
    }
    
    // 解析抽奖数据
    const lotteryData = parseLotteryContent(lotteryMatch[1]);
    if (!lotteryData) return;
    
    // 创建抽奖显示组件
    const lotteryWidget = createLotteryWidget(lotteryData, helper);
    
    // 隐藏原始文本
    parentElement.style.display = 'none';
    
    // 插入抽奖组件
    parentElement.parentNode.insertBefore(lotteryWidget, parentElement.nextSibling);
    
    console.log("🎲 Created lottery widget:", lotteryData.prize_name);
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
  
  function createLotteryWidget(lotteryData, helper) {
    const widget = document.createElement('div');
    widget.className = `lottery-display-card lottery-status-${lotteryData.status}`;
    widget.setAttribute('data-lottery-processed', 'true');
    
    const statusText = getStatusText(lotteryData.status);
    const formattedTime = formatTime(lotteryData.draw_time);
    
    widget.innerHTML = generateLotteryHTML(lotteryData, statusText, formattedTime);
    
    // 添加交互功能
    initializeWidgetInteractions(widget, lotteryData);
    
    return widget;
  }
  
  function generateLotteryHTML(data, statusText, formattedTime) {
    return `
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
  }
  
  function initializeWidgetInteractions(widget, data) {
    // 添加点击效果
    widget.addEventListener('click', function(e) {
      if (e.target.tagName === 'IMG') {
        // 图片点击放大效果
        showImageModal(e.target.src);
      }
    });
    
    // 添加倒计时功能（如果抽奖进行中）
    if (data.status === 'running' && data.draw_time) {
      startCountdown(widget, data.draw_time);
    }
  }
  
  function startCountdown(widget, drawTime) {
    try {
      const endTime = new Date(drawTime).getTime();
      
      const updateCountdown = () => {
        const now = new Date().getTime();
        const distance = endTime - now;
        
        if (distance < 0) {
          // 时间已到
          const footer = widget.querySelector('.lottery-footer');
          if (footer) {
            footer.innerHTML = '<div class="countdown-ended">⏰ 开奖时间已到，请等待系统处理...</div>';
          }
          return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        let countdownText;
        if (days > 0) {
          countdownText = `⏱️ 距离开奖：${days}天 ${hours}小时 ${minutes}分钟`;
