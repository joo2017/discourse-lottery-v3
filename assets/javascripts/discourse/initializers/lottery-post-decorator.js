// assets/javascripts/discourse/initializers/lottery-post-decorator.js
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "lottery-post-decorator",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 抽奖帖子装饰器初始化");

      // 监听 MessageBus 消息以实时更新
      api.onPageChange(() => {
        const messageBus = api.container.lookup("service:message-bus");
        if (messageBus) {
          const topicId = document.querySelector('.topic-post article')?.dataset?.topicId;
          if (topicId) {
            messageBus.subscribe(`/topic/${topicId}`, (data) => {
              console.log("🎲 收到实时消息:", data);
              if (data.type === 'lottery_created' || data.type === 'lottery_updated' || data.type === 'lottery_completed') {
                // 重新渲染抽奖组件
                setTimeout(() => {
                  api.container.lookup("service:app-events").trigger("lottery:refresh");
                }, 500);
              }
            });
          }
        }
      });

      // 装饰帖子，添加抽奖显示组件
      api.decoratePost((element, post) => {
        console.log("🎲 装饰帖子:", post.id, "帖子号码:", post.post_number);
        
        // 只处理主楼层 (post_number === 1)
        if (post.post_number !== 1) {
          return;
        }

        // 检查是否有抽奖数据
        const lotteryData = post.lottery_data;
        console.log("🎲 检查抽奖数据:", lotteryData);
        
        if (!lotteryData) {
          console.log("🎲 没有抽奖数据，跳过");
          return;
        }

        // 查找现有的抽奖显示组件，避免重复渲染
        const existingDisplay = element.querySelector('.lottery-display-card');
        if (existingDisplay) {
          console.log("🎲 已存在抽奖显示组件，跳过");
          return;
        }

        console.log("🎲 开始渲染抽奖显示组件");

        // 创建抽奖显示HTML
        const lotteryHtml = createLotteryDisplayHTML(lotteryData);
        
        // 查找插入位置 - 在帖子内容的开头
        const postContent = element.querySelector('.cooked');
        if (postContent) {
          // 创建容器元素
          const lotteryContainer = document.createElement('div');
          lotteryContainer.className = 'lottery-post-display';
          lotteryContainer.innerHTML = lotteryHtml;
          
          // 插入到帖子内容之前
          postContent.insertBefore(lotteryContainer, postContent.firstChild);
          
          console.log("🎲 抽奖显示组件已插入");
        } else {
          console.warn("🎲 未找到帖子内容容器");
        }
      });

      // 处理原始的 [lottery] 标签，替换为组件
      api.decoratePost((element, post) => {
        if (post.post_number !== 1) return;

        const lotteryTags = element.querySelectorAll('.cooked');
        lotteryTags.forEach(cookedElement => {
          const content = cookedElement.innerHTML;
          
          // 查找并替换 [lottery]...[/lottery] 标签
          const lotteryRegex = /\[lottery\]([\s\S]*?)\[\/lottery\]/g;
          const updatedContent = content.replace(lotteryRegex, (match, lotteryContent) => {
            console.log("🎲 发现并替换 lottery 标签");
            
            // 解析标签内容
            const parsedData = parseLotteryTagContent(lotteryContent);
            
            if (parsedData && Object.keys(parsedData).length > 0) {
              // 返回空字符串，因为我们通过 lottery_data 来渲染组件
              return '<!-- lottery component rendered via decorator -->';
            }
            
            return match; // 保持原样如果解析失败
          });
          
          if (updatedContent !== content) {
            cookedElement.innerHTML = updatedContent;
          }
        });
      });

      // 监听刷新事件
      api.onAppEvent("lottery:refresh", () => {
        console.log("🎲 收到刷新事件，重新加载页面");
        // 重新加载当前页面以获取最新数据
        window.location.reload();
      });
    });
  },
};

// 解析 lottery 标签内容的辅助函数
function parseLotteryTagContent(content) {
  const data = {};
  const lines = content.split('\n');
  
  lines.forEach(line => {
    line = line.trim();
    if (line && line.includes('：')) {
      const [key, value] = line.split('：', 2);
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      
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
          data.specified_posts = trimmedValue;
          break;
        case '参与门槛':
          const participants = trimmedValue.match(/\d+/);
          data.min_participants = participants ? parseInt(participants[0]) : 5;
          break;
        case '补充说明':
          data.additional_notes = trimmedValue;
          break;
        case '奖品图片':
          data.prize_image = trimmedValue;
          break;
      }
    }
  });
  
  return data;
}

// 创建抽奖显示HTML的函数
function createLotteryDisplayHTML(lotteryData) {
  const statusClass = `lottery-status-${lotteryData.status || 'running'}`;
  const statusText = getStatusText(lotteryData.status || 'running');
  const isSpecifiedType = lotteryData.lottery_type === 'specified' || 
                         (lotteryData.specified_posts && lotteryData.specified_posts.trim());
  
  let html = `
    <div class="lottery-display-card ${statusClass}">
      <div class="lottery-header">
        <div class="lottery-title">
          <span class="lottery-icon">🎲</span>
          <h3>${escapeHtml(lotteryData.prize_name || '')}</h3>
        </div>
        <div class="lottery-status">${statusText}</div>
      </div>
      <div class="lottery-content">`;

  // 添加奖品图片
  if (lotteryData.prize_image) {
    html += `
        <div class="lottery-image">
          <img src="${escapeHtml(lotteryData.prize_image)}" alt="奖品图片" />
        </div>`;
  }

  html += `
        <div class="lottery-details">
          <div class="lottery-detail-item">
            <span class="label">🎁 奖品说明：</span>
            <span class="value">${escapeHtml(lotteryData.prize_details || '')}</span>
          </div>
          <div class="lottery-detail-item">
            <span class="label">⏰ 开奖时间：</span>
            <span class="value">${formatDrawTime(lotteryData.draw_time)}</span>
          </div>
          <div class="lottery-detail-item">
            <span class="label">🎯 抽奖方式：</span>
            <span class="value">`;

  if (isSpecifiedType) {
    html += `指定楼层 (${escapeHtml(lotteryData.specified_posts || '')})`;
  } else {
    html += `随机抽取 ${lotteryData.winners_count || 1} 人`;
  }

  html += `</span>
          </div>
          <div class="lottery-detail-item">
            <span class="label">👥 参与门槛：</span>
            <span class="value">至少 ${lotteryData.min_participants || 5} 人参与</span>
          </div>`;

  // 添加补充说明
  if (lotteryData.additional_notes) {
    html += `
          <div class="lottery-detail-item">
            <span class="label">📝 补充说明：</span>
            <span class="value">${escapeHtml(lotteryData.additional_notes)}</span>
          </div>`;
  }

  html += `
        </div>
      </div>
      <div class="lottery-footer">
        <div class="participation-tip">
          💡 <strong>参与方式：</strong>在本话题下回复即可参与抽奖
        </div>
      </div>
    </div>`;

  return html;
}

// 辅助函数
function getStatusText(status) {
  const statusMap = {
    'running': '🏃 进行中',
    'finished': '🎉 已开奖',
    'cancelled': '❌ 已取消'
  };
  return statusMap[status] || '🏃 进行中';
}

function formatDrawTime(drawTime) {
  if (!drawTime) return '';
  
  try {
    const date = new Date(drawTime);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return drawTime;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
