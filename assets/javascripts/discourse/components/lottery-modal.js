import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";

export default class LotteryModal extends Component {
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";

  @action
  handleInput(ev, name) {
    this[name] = ev.target.value;
  }

  get canSubmit() {
    return this.prizeName && this.prizeDetails && this.drawTime;
  }

  @action
  submit() {
    if (!this.canSubmit) return;
    // 回调到 toolbar
    this.args.model.onSubmit({
      prize_name: this.prizeName,
      prize_details: this.prizeDetails,
      draw_time: this.drawTime
    });
    this.args.closeModal();
  }

  @action
  close() {
    this.args.closeModal();
  }
}
