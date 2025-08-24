// assets/javascripts/discourse/components/lottery-display.js
import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";

export default class LotteryDisplayComponent extends Component {
  get lotteryData() {
    return this.args.data || {};
  }

  get isSpecifiedType() {
    return this.lotteryData.specified_posts && this.lotteryData.specified_posts.trim();
  }

  get formattedDrawTime() {
    if (!this.lotteryData.draw_time) return '';
    
    const date = new Date(this.lotteryData.draw_time);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get statusText() {
    const status = this.lotteryData.status || 'running';
    const statusMap = {
      'running': '🏃 进行中',
      'finished': '🎉 已开奖',
      'cancelled': '❌ 已取消'
    };
    return statusMap[status] || '🏃 进行中';
  }

  get statusClass() {
    const status = this.lotteryData.status || 'running';
    return `lottery-status-${status}`;
  }
}
