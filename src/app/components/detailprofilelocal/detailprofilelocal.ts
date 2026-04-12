import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detailprofilelocal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detailprofilelocal.html',
  styleUrl: './detailprofilelocal.scss',
})
export class Detailprofilelocal {
avatarUrl: string = '';
  constructor(public global: GlobalService){}
  ngOnInit() {
    const partner = this.global.selectedPartner;
    if (!partner) return;
  
    if (partner.avatar?.startsWith('http')) {
      this.avatarUrl = partner.avatar;
    } else if (partner.avatar) {
      this.avatarUrl = this.global.pb.files.getUrl(
        partner,
        partner.avatar,              // filename
        { $autoCancel: false }
      );
    } else if (partner.files?.length) {
      this.avatarUrl = partner.files[0];
    } else {
      this.avatarUrl = 'assets/images/user/pic1.jpg';
    }
  
    console.log('Detail avatarUrl:', this.avatarUrl);
  }
  
}
