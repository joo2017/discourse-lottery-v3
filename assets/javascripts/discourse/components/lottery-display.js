import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryDisplay extends Component {
  @service currentUser;

  get lotteryData() {
    const lotteryJson = this.args.topic?.custom_fields?.lottery;
    if (!lotteryJson) return null;
    
    try {
      return JSON.parse(lotteryJson);
    } catch (e) {
      console.error("Failed to parse lottery data:", e);
      return null;
    }
  }

  get isLotteryCreator() {
    return this.currentUser?.id === this.args.topic?.user_id;
  }

  get formattedDrawTime() {
    if (!this.lotteryData?.draw_time) return "";
    
    const date = new Date(this.lotteryData.draw_time);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get lotteryType() {
    if (this.lotteryData?.specified_posts) {
      return '指定楼层';
    }
    return '随机抽取';
  }

  get backupStrategyText() {
    if (this.lotteryData?.backup_strategy === 'continue') {
      return '人数不足时继续开奖';
    }
    return '人数不足时取消活动';
  }
}
