import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteState } from '../../../../state/route.state';
import { DEFAULT_PROFILES, ProfileInfo } from '../../../../core/services/brouter/brouter.types';

@Component({
  selector: 'app-profile-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Routing Profile
      </label>

      <!-- Dropdown Button -->
      <button
        type="button"
        (click)="toggleDropdown()"
        (blur)="onBlur()"
        class="relative w-full cursor-pointer rounded-lg bg-white py-2.5 pl-3 pr-10 text-left shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm sm:leading-6 transition-all hover:ring-gray-400"
        [class.ring-primary-500]="isOpen()"
        [class.ring-2]="isOpen()"
        aria-haspopup="listbox"
        [attr.aria-expanded]="isOpen()">
        <span class="flex items-center">
          <span class="block truncate font-medium">{{ selectedProfileInfo()?.name }}</span>
        </span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg
            class="h-5 w-5 text-gray-400 transition-transform duration-200"
            [class.rotate-180]="isOpen()"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clip-rule="evenodd" />
          </svg>
        </span>
      </button>

      <!-- Selected Profile Description -->
      @if (selectedProfileInfo()?.description) {
        <p class="mt-1 text-xs text-gray-500">
          {{ selectedProfileInfo()?.description }}
        </p>
      }

      <!-- Dropdown Options -->
      @if (isOpen()) {
        <ul
          class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
          tabindex="-1"
          role="listbox">
          @for (profile of profiles; track profile.id) {
            <li
              (mousedown)="selectProfile(profile)"
              class="relative cursor-pointer select-none py-2 pl-3 pr-9 transition-colors"
              [class.bg-primary-50]="profile.id === routeState.selectedProfile()"
              [class.text-primary-900]="profile.id === routeState.selectedProfile()"
              [class.hover:bg-gray-100]="profile.id !== routeState.selectedProfile()"
              role="option"
              [attr.aria-selected]="profile.id === routeState.selectedProfile()">
              <div class="flex flex-col">
                <span
                  class="block truncate"
                  [class.font-semibold]="profile.id === routeState.selectedProfile()"
                  [class.font-normal]="profile.id !== routeState.selectedProfile()">
                  {{ profile.name }}
                </span>
                @if (profile.description) {
                  <span
                    class="block truncate text-xs"
                    [class.text-primary-600]="profile.id === routeState.selectedProfile()"
                    [class.text-gray-500]="profile.id !== routeState.selectedProfile()">
                    {{ profile.description }}
                  </span>
                }
              </div>

              <!-- Checkmark for selected item -->
              @if (profile.id === routeState.selectedProfile()) {
                <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-primary-600">
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fill-rule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clip-rule="evenodd" />
                  </svg>
                </span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class ProfileSelectorComponent {
  readonly routeState = inject(RouteState);
  readonly profiles: ProfileInfo[] = DEFAULT_PROFILES;
  readonly isOpen = signal(false);

  /**
   * Computed signal for the currently selected profile info
   */
  readonly selectedProfileInfo = computed(() =>
    this.profiles.find(p => p.id === this.routeState.selectedProfile())
  );

  toggleDropdown(): void {
    this.isOpen.update(open => !open);
  }

  selectProfile(profile: ProfileInfo): void {
    this.routeState.setProfile(profile.id);
    this.isOpen.set(false);
  }

  onBlur(): void {
    // Delay closing to allow click events on options to fire
    setTimeout(() => {
      this.isOpen.set(false);
    }, 150);
  }
}
