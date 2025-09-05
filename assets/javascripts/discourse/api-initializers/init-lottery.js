// assets/javascripts/discourse/api-initializers/init-lottery.js
// 增强错误处理版本

import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.14.0", (api) => {
  console.log("🎲 Lottery: Initializing display component with robust error handling");
  
  const siteSettings = api.container.lookup('service:site-settings');
  
  if (!siteSettings.lottery_enabled) {
    console.log("🎲 Lottery disabled");
    return;
  }
  
  let processedElements = new WeakSet();
  let debugMode = window.location.search.includes('lottery_debug=1');
  
  // 修复：更安全的decorateCooked实现
  api.decorateCooked((element, helper) => {
    // 修复1：严格的输入验证
    if (!isValidElement(element)) {
      if (debugMode) {
        console.log("🎲 Invalid element:", typeof element, element);
      }
      return;
    }
    
    if (processedElements.has(element)) {
      return;
    }
    
    try {
      processLotteryContent(element, helper);
      processedElements.add(element);
    } catch (error) {
      console.error("🎲 Lottery decorateCooked error:", error);
      if (debugMode) {
        console.log("🎲 Error context:", {
          element,
          elementType: typeof element,
          nodeType: element?.nodeType,
          innerHTML: element?.innerHTML?.substring(0, 100)
        });
      }
    }
  }, {
    id: "lottery-content-processor",
    onlyStream: true
  });
  
  function isValidElement(element) {
    return element && 
           typeof element === 'object' && 
           element.nodeType === Node.ELEMENT_NODE &&
           element.ownerDocument === document;
  }
  
  function processLotteryContent(element, helper) {
    if (debugMode) {
      console.log("🎲 Processing element:", element);
    }
    
    try {
      // 方法1：安全的文本查找
      const lotteryElements = findLotteryElements(element);
      
      if (lotteryElements.length > 0) {
        console.log(`🎲 Found ${lotteryElements.length} lottery elements`);
        
        lotteryElements.forEach(lotteryElement => {
          processLotteryElement(lotteryElement, helper);
        });
      }
    } catch (error) {
      console.error("🎲 Error in processLotteryContent:", error);
    }
  }
  
  function findLotteryElements(element) {
    const results = [];
    
    try {
      // 方法1：查找包含lottery标记的段落和div
      const textElements = element.querySelectorAll('p, div, span');
      
      textElements.forEach(el => {
        const text = el.textContent || '';
        if (text.includes('[lottery]') && text.includes('[/lottery]')) {
          // 检查是否已处理
          if (!el.querySelector('.lottery-display-card') && 
              !el.nextElementSibling?.classList.contains('lottery-display-card')) {
            results.push(el);
          }
        }
      });
      
      // 方法2：直接检查element本身
      const elementText = element.textContent || '';
      if (elementText.includes('[lottery]') && elementText.includes('[/lottery]') && 
          !element.querySelector('.lottery-display-card')) {
        // 查找具体的文本节点
        const textNodes = getTextNodes(element);
        textNodes.forEach(node => {
          const text = node.textContent || '';
          if (text.includes('[lottery]') && text.includes('[/lottery]')) {
            results.push(node.parentElement || element);
          }
        });
      }
      
    } catch (error) {
      console.error("🎲 Error finding lottery elements:", error);
    }
    
    return [...new Set(results)]; // 去重
  }
  
  function getTextNodes(element) {
    const textNodes = [];
    
    function walk(node) {
      try {
        if (node.nodeType === Node.TEXT_NODE) {
          textNodes.push(node);
        } else if (node.nodeType === Node.ELEMENT_NODE && node.childNodes) {
          Array.from(node.childNodes).forEach(walk);
        }
      } catch (e) {
        // 忽略无法访问的节点
      }
    }
    
    walk(element);
    return textNodes;
  }
  
  function processLotteryElement(element, helper) {
    try {
      const text = element.textContent || element.innerHTML || '';
      const lotteryMatch = text.match(/\[lottery\](.*?)\[\/lottery\]/s);
      
      if (!lotteryMatch) {
        return;
      }
      
      console.log("🎲 Processing lottery element with content");
      
      // 解析抽奖数据
      const lotteryData = parseLotteryContent(lotteryMatch[1]);
      if (!lotteryData) {
        console.warn("🎲 Failed to parse lottery data");
        return;
      }
      
      // 隐藏原始元素
      element.style.display = 'none';
      
      // 创建并插入抽奖组件
      const lotteryWidget = createLotteryWidget(lotteryData);
      
      // 安全插入
      if (element.parentNode) {
        element.parentNode.insertBefore(lotteryWidget, element.nextSibling);
        console.log("🎲 Lottery widget inserted successfully");
      } else {
        console.warn("🎲 Cannot insert widget: no parent node");
      }
      
    } catch (error) {
      console.error("🎲 Error processing lottery element:", error);
    }
  }
  
  function parseLotteryContent(content) {
    if (!content || typeof content !== 'string') {
      return null;
    }
    
    const data = {
      status: 'running'
    };
    
    try {
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
      
      // 验证必填字段
      if (!data.prize_name || !data.prize_details || !data.draw_time) {
        console.warn("🎲 Missing required fields in lottery data");
        return null;
      }
      
      return data;
      
    } catch (error) {
      console.error("🎲 Error parsing lottery content:", error);
      return null;
    }
  }
  
  function createLotteryWidget(data) {
    const widget = document.createElement('div');
    widget.className = `lottery-display-card lottery-status-${data.status}`;
    widget.setAttribute('data-lottery-processed', 'true');
    
    const statusText = getStatusText(data.status);
    const formattedTime = formatTime(data.draw_time);
    
    try {
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
      setTimeout(() => {
        addWidgetInteractions(widget, data);
      }, 100);
      
    } catch (error) {
      console.error("🎲 Error creating lottery widget:", error);
      
      // 备用简单版本
      widget.innerHTML = `
        <div class="lottery-display-card">
          <h3>🎲 ${escapeHtml(data.prize_name)}</h3>
          <p>奖品：${escapeHtml(data.prize_details)}</p>
          <p>开奖时间：${formattedTime}</p>
          <p>💡 参与方式：在本话题下回复即可参与抽奖</p>
        </div>
      `;
    }
    
    return widget;
  }
  
  function addWidgetInteractions(widget, data) {
    try {
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
    } catch (error) {
      console.error("🎲 Error adding widget interactions:", error);
    }
  }
  
  function showImageModal(imageSrc) {
    // 实现图片模态框
    try {
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
      
      document.body.appendChild(modal);
    } catch (error) {
      console.error("🎲 Error showing image modal:", error);
    }
  }
  
  function startCountdown(widget, drawTime) {
    try {
      const endTime = new Date(drawTime).getTime();
      if (isNaN(endTime)) return;
      
      const updateCountdown = () => {
        try {
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
        } catch (error) {
          console.error("🎲 Countdown update error:", error);
        }
      };
      
      updateCountdown();
    } catch (error) {
      console.error("🎲 Countdown initialization error:", error);
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
    try {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    } catch (error) {
      return String(text).replace(/[&<>"']/g, function(m) {
        const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return map[m];
      });
    }
  }
  
  // 页面切换清理
  api.onPageChange(() => {
    try {
      // 清理模态框
      document.querySelectorAll('.lottery-image-modal').forEach(modal => {
        modal.remove();
      });
      
      // 重置处理标记
      processedElements = new WeakSet();
    } catch (error) {
      console.error("🎲 Cleanup error:", error);
    }
  });
  
  // 调试功能
  if (debugMode) {
    window.lotteryDebug = {
      processedElements,
      findLotteryElements,
      processLotteryContent,
      isValidElement
    };
    console.log("🎲 Debug mode enabled");
  }
  
  console.log("🎲 Lottery: Display component initialization completed");
});
