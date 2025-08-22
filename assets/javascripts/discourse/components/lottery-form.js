import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryForm extends Component {
  @service siteSettings;
  
  // 表单数据
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";

  // 错误状态
  @tracked errors = {};

  constructor() {
    super(...arguments);
    // 初始化最小参与人数
    this.minParticipants = this.siteSettings.lottery_min_participants_global || 5;
  }

  // 获取全局最小参与人数
  get globalMinParticipants() {
    return this.siteSettings.lottery_min_participants_global || 5;
  }

  // 检查表单是否有效
  get isFormValid() {
    return (
      this.prizeName.trim().length > 0 &&
      this.prizeDetails.trim().length > 0 &&
      this.drawTime.length > 0 &&
      this.winnersCount > 0 &&
      this.minParticipants >= this.globalMinParticipants &&
      Object.keys(this.errors).length === 0
    );
  }

  @action
  updatePrizeName(event) {
    this.prizeName = event.target.value;
    this.validateRequired("prizeName", this.prizeName, "活动名称");
  }

  @action
  updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
    this.validateRequired("prizeDetails", this.prizeDetails, "奖品说明");
  }

  @action
  updateDrawTime(event) {
    this.drawTime = event.target.value;
    this.validateRequired("drawTime", this.drawTime, "开奖时间");
    this.validateDrawTime();
  }

  @action
  updateWinnersCount(event) {
    this.winnersCount = parseInt(event.target.value) || 1;
    this.validateWinnersCount();
  }

  @action
  updateSpecifiedPosts(event) {
    this.specifiedPosts = event.target.value;
    this.validateSpecifiedPosts();
  }

  @action
  updateMinParticipants(event) {
    this.minParticipants = parseInt(event.target.value) || 1;
    this.validateMinParticipants();
  }

  @action
  updateBackupStrategy(event) {
    this.backupStrategy = event.target.value;
  }

  @action
  updateAdditionalNotes(event) {
    this.additionalNotes = event.target.value;
  }

  // 验证必填字段
  validateRequired(field, value, label) {
    if (!value || value.trim().length === 0) {
      this.errors = { ...this.errors, [field]: `${label}不能为空` };
    } else {
      const newErrors = { ...this.errors };
      delete newErrors[field];
      this.errors = newErrors;
    }
  }

  // 验证开奖时间
  validateDrawTime() {
    if (!this.drawTime) return;
    
    const drawDate = new Date(this.drawTime);
    const now = new Date();
    
    if (drawDate <= now) {
      this.errors = { ...this.errors, drawTime: "开奖时间必须是未来时间" };
    } else {
      const newErrors = { ...this.errors };
      delete newErrors.drawTime;
      this.errors = newErrors;
    }
  }

  // 验证获奖人数
  validateWinnersCount() {
    if (this.winnersCount < 1) {
      this.errors = { ...this.errors, winnersCount: "获奖人数不能少于1" };
    } else {
      const newErrors = { ...this.errors };
      delete newErrors.winnersCount;
      this.errors = newErrors;
    }
  }

  // 验证指定楼层
  validateSpecifiedPosts() {
    if (!this.specifiedPosts.trim()) {
      const newErrors = { ...this.errors };
      delete newErrors.specifiedPosts;
      this.errors = newErrors;
      return;
    }

    const posts = this.specifiedPosts.split(",").map(s => s.trim()).filter(s => s);
    const invalidPosts = posts.filter(post => {
      const num = parseInt(post);
      return isNaN(num) || num < 2; // 楼层号必须是数字且大于1（主楼是1楼）
    });

    if (invalidPosts.length > 0) {
      this.errors = { ...this.errors, specifiedPosts: `无效的楼层号: ${invalidPosts.join(", ")}` };
    } else {
      const newErrors = { ...this.errors };
      delete newErrors.specifiedPosts;
      this.errors = newErrors;
    }
  }

  // 验证参与门槛
  validateMinParticipants() {
    if (this.minParticipants < this.globalMinParticipants) {
      this.errors = { ...this.errors, minParticipants: `参与门槛不能低于${this.globalMinParticipants}人` };
    } else {
      const newErrors = { ...this.errors };
      delete newErrors.minParticipants;
      this.errors = newErrors;
    }
  }

  // 获取表单数据
  get formData() {
    const data = {
      prize_name: this.prizeName,
      prize_details: this.prizeDetails,
      draw_time: this.drawTime,
      winners_count: this.winnersCount,
      specified_posts: this.specifiedPosts,
      min_participants: this.minParticipants,
      backup_strategy: this.backupStrategy,
      additional_notes: this.additionalNotes
    };
    
    console.log("🎲 Lottery form data:", data);
    return data;
  }

  didInsertElement() {
    super.didInsertElement?.(...arguments);
    // 尝试注册到 composer
    const composer = document.querySelector('.composer-fields')?.closest('.composer-container');
    if (composer && composer.__controller) {
      composer.__controller._lotteryFormComponent = this;
      console.log("🎲 Registered lottery form to composer");
    }
  }
}
