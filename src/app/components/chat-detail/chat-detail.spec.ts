import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatDetail } from './chat-detail';

describe('ChatDetail', () => {
  let component: ChatDetail;
  let fixture: ComponentFixture<ChatDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
